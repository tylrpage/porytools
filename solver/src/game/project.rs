//! Projection: an all-seeing record seen by one player (`docs/game-format.md`,
//! "Projection"). Identities the player never saw become unknown, the opponent's deck
//! looks are dropped, and wherever a card turns face up for the player (it enters a public
//! zone, or their hand), a `reveal` is added so the projected record still folds.

use std::collections::{BTreeMap, BTreeSet};

use super::action::{Action, Change, ChangeKind, NewCard, Note, Seen, Zone};
use super::fold::{apply_change, begin_action, face_down_now, finish_action};
use super::record::{Id, Player, PlayerInfo, Print, Record, RecordError, StartDeck, Viewer};
use super::state::State;

/// What the viewer knows after a node: the all-seeing state, and which instances the
/// viewer has seen.
#[derive(Clone)]
struct Progress {
    state: State,
    known: BTreeSet<Id>,
}

pub fn project(record: &Record, viewer: Player) -> Result<Record, RecordError> {
    record.validate()?;
    if viewer > 1 {
        return Err(RecordError::record(format!("no player {viewer}")));
    }
    match record.viewpoint {
        Viewer::All => {}
        Viewer::Player(p) if p == viewer => return Ok(record.clone()),
        Viewer::Player(_) => {
            return Err(RecordError::record("can't project another player's record"));
        }
    }

    let mut out = record.clone();
    out.viewpoint = Viewer::Player(viewer);
    let opponent = (1 - viewer) as usize;
    out.players[opponent] = PlayerInfo::default();
    out.start.players[opponent].deck = StartDeck {
        count: record.start.players[opponent].deck.count,
        contents: None,
    };

    let start = Progress {
        state: State::new_game(&record.start),
        known: BTreeSet::new(),
    };
    let mut after: Vec<Progress> = Vec::with_capacity(record.nodes.len());
    for (i, node) in record.nodes.iter().enumerate() {
        let mut progress = match record.parent_of(i) {
            None => start.clone(),
            Some(p) => after[p].clone(),
        };
        out.nodes[i].action = project_action(&mut progress, i, &node.action, viewer)?;
        after.push(progress);
    }
    Ok(out)
}

fn project_action(
    progress: &mut Progress,
    node: usize,
    action: &Action,
    viewer: Player,
) -> Result<Action, RecordError> {
    let mut changes = Vec::new();
    begin_action(&mut progress.state, node, action)?;
    let face_down = face_down_now(&progress.state);
    for (c, change) in action.changes.iter().enumerate() {
        if let Some(projected) = project_change(progress, change, viewer) {
            changes.push(projected);
        }
        // Apply the original to the all-seeing state, then see what turned face up.
        apply_change(&mut progress.state, change, face_down).map_err(|message| RecordError {
            node: Some(node),
            change: Some(c),
            message,
        })?;
        progress.known.retain(|id| progress.state.cards.contains_key(id));
        changes.extend(sweep(progress, viewer));
    }
    finish_action(&mut progress.state, node, action)?;
    // revealStart flips the starting Pokémon after its changes.
    changes.extend(sweep(progress, viewer));
    Ok(Action {
        kind: action.kind.clone(),
        changes,
        note: action.note.clone(),
    })
}

/// The change as the viewer sees it, or `None` if they don't see it at all.
fn project_change(progress: &mut Progress, change: &Change, viewer: Player) -> Option<Change> {
    let kind = match &change.kind {
        ChangeKind::Draw { player, cards } => {
            let top = progress.state.players[*player as usize].deck.top.clone();
            let cards = cards
                .iter()
                .enumerate()
                .map(|(n, card)| {
                    // A drawn card that was a known top card keeps its identity if the viewer
                    // knew it.
                    let knew = top.get(n).is_some_and(|id| progress.known.contains(id));
                    learn(progress, card, *player == viewer || knew)
                })
                .collect();
            ChangeKind::Draw {
                player: *player,
                cards,
            }
        }
        ChangeKind::FromDeck {
            player,
            cards,
            to,
            seen,
        } => {
            // Prizes are face down: not even the owner sees them.
            let owner_sees = *player == viewer && to.zone != Zone::Prizes;
            let sees = to.zone.is_public() || *seen == Some(Seen::All) || owner_sees;
            let cards = cards.iter().map(|card| learn(progress, card, sees)).collect();
            ChangeKind::FromDeck {
                player: *player,
                cards,
                to: to.clone(),
                seen: None,
            }
        }
        ChangeKind::Reveal { cards, to } => {
            if !to.includes(viewer) {
                return None;
            }
            progress.known.extend(cards.keys());
            ChangeKind::Reveal {
                cards: cards.clone(),
                to: *to,
            }
        }
        ChangeKind::LookAtDeck { player, .. } if *player != viewer => return None,
        other => other.clone(),
    };
    Some(Change {
        kind,
        note: change.note.clone(),
    })
}

fn learn(progress: &mut Progress, card: &NewCard, sees: bool) -> NewCard {
    if sees {
        progress.known.insert(card.id);
        card.clone()
    } else {
        NewCard {
            id: card.id,
            card: None,
        }
    }
}

/// Reveals for every card the viewer can now see but hadn't: face-up cards in play and in
/// discard / Lost Zone / Stadium (to everyone), and cards in the viewer's own hand or
/// pending zone (to the viewer).
fn sweep(progress: &mut Progress, viewer: Player) -> Vec<Change> {
    let state = &progress.state;
    let mut public: Vec<Id> = state.stadium.clone();
    let mut private: Vec<Id> = Vec::new();
    for (i, p) in state.players.iter().enumerate() {
        public.extend(&p.discard);
        public.extend(&p.lost_zone);
        for pokemon in p.active.iter().chain(p.bench.iter()) {
            if !pokemon.face_down {
                public.extend(&pokemon.stack);
            }
            public.extend(&pokemon.attached);
        }
        if i == viewer as usize {
            private.extend(&p.hand);
            private.extend(&p.pending);
        }
    }
    let mut reveal = |ids: Vec<Id>, to: Viewer| -> Option<Change> {
        let cards: BTreeMap<Id, Print> = ids
            .into_iter()
            .filter(|id| !progress.known.contains(id))
            .filter_map(|id| Some((id, state.cards.get(&id)?.card.clone()?)))
            .collect();
        if cards.is_empty() {
            return None;
        }
        progress.known.extend(cards.keys());
        Some(Change {
            kind: ChangeKind::Reveal { cards, to },
            note: Note::default(),
        })
    };
    let mut out: Vec<Change> = Vec::new();
    out.extend(reveal(public, Viewer::All));
    out.extend(reveal(private, Viewer::Player(viewer)));
    out
}
