//! Record format tests: the fixtures (the spec's examples and the owner's full PTCG Live
//! game) parse, fold, project, and round-trip; and the fold's bookkeeping and consistency
//! errors on small hand-written records.

use porytools_solver::game::{self, Record, State};
use serde_json::{Value, json};

fn fixture(name: &str) -> String {
    let path = format!("{}/tests/fixtures/{name}", env!("CARGO_MANIFEST_DIR"));
    std::fs::read_to_string(&path).unwrap_or_else(|e| panic!("{path}: {e}"))
}

fn parse(json: &str) -> Record {
    Record::from_json(json).unwrap_or_else(|e| panic!("{e}"))
}

fn end_state(record: &Record) -> State {
    game::fold(record, record.main_line_end()).unwrap_or_else(|e| panic!("{e}"))
}

const FIXTURES: [&str; 2] = ["solver-opening.json", "ptcgl-game.json"];

#[test]
fn fixtures_round_trip() {
    for name in FIXTURES {
        let text = fixture(name);
        let original: Value = serde_json::from_str(&text).unwrap();
        let reserialized: Value = serde_json::from_str(&parse(&text).to_json()).unwrap();
        assert_eq!(original, reserialized, "{name} changed in a round trip");
    }
}

#[test]
fn fixtures_have_no_consistency_errors() {
    for name in FIXTURES {
        let errors = game::check(&parse(&fixture(name)));
        assert!(errors.is_empty(), "{name}: {errors:?}");
    }
}

#[test]
fn live_game_ends_as_logged() {
    let record = parse(&fixture("ptcgl-game.json"));
    let s = end_state(&record);
    assert_eq!(s.turn, 6);
    assert_eq!(s.result.as_ref().map(|r| r.winner), Some(Some(1)));
    let (me, them) = (&s.players[0], &s.players[1]);
    assert!(me.active.is_none() && me.bench.is_empty());
    assert_eq!(me.prizes.len(), 6);
    assert_eq!(them.prizes.len(), 4);
    // Dragapult ex on the Fire Dreepy's stack, holding Fire + Psychic.
    let active = them.active.as_ref().unwrap();
    assert_eq!(active.stack, vec![115, 124, 120]);
    assert_eq!(active.attached, vec![104, 114]);
    assert_eq!(s.print_of(120), Some("ASC-160"));
    // Risky Ruins replaced Festival Grounds.
    assert_eq!(s.stadium, vec![125]);
    assert!(me.discard.contains(&16));
    // Recon Directive put two unknown cards on the bottom.
    assert_eq!(them.deck.bottom, vec![126, 129, 131]);
    assert_eq!(s.print_of(126), None);
    // Total cards are conserved: 60 each.
    for (p, ps) in s.players.iter().enumerate() {
        let in_play: usize = ps
            .active
            .iter()
            .chain(&ps.bench)
            .map(|pk| pk.stack.len() + pk.attached.len())
            .sum();
        let stadium = s.stadium.iter().filter(|id| s.cards[id].owner == p as u8).count();
        let total = ps.deck.size() as usize
            + ps.hand.len()
            + ps.discard.len()
            + ps.prizes.len()
            + ps.lost_zone.len()
            + ps.pending.len()
            + in_play
            + stadium;
        assert_eq!(total, 60, "player {p}");
    }
}

#[test]
fn live_game_mid_state() {
    let record = parse(&fixture("ptcgl-game.json"));
    // Node 13: your turn 1 just ended.
    let s = game::fold(&record, Some(13)).unwrap();
    assert_eq!(s.turn, 1);
    assert_eq!(s.turn_player(), Some(0));
    assert_eq!(s.own_turn_number(0, s.turn), Some(1));
    let bench = &s.players[0].bench[0];
    assert_eq!(
        (bench.stack.clone(), bench.attached.clone()),
        (vec![15], vec![14])
    );
    // Itchy Pollen's 10 damage after their turn 1.
    let s = game::fold(&record, Some(20)).unwrap();
    assert_eq!(s.players[0].active.as_ref().unwrap().counters, 1);
    assert_eq!(s.own_turn_number(1, s.turn), Some(1));
}

#[test]
fn solver_example_main_line_and_branch() {
    let record = parse(&fixture("solver-opening.json"));
    let main = end_state(&record);
    assert_eq!(main.players[0].bench[0].attached, vec![3]);
    assert_eq!(main.players[0].deck.count, 60 - 7 - 6 - 1 - 1);
    // Known contents follow every card out of the deck.
    let contents = main.players[0].deck.contents.as_ref().unwrap();
    let applins = contents.iter().find(|(p, _)| p == "PRE-9").map(|(_, n)| *n);
    assert_eq!(applins, Some(1)); // 4 - opening hand - prize - Poké Pad
    // The branch from node 5 shuffles the hand back and draws 8.
    let branch = game::fold(&record, Some(10)).unwrap();
    assert_eq!(branch.players[0].hand.len(), 8);
    assert!(branch.players[0].discard.contains(&6));
    assert!(
        !branch.cards.contains_key(&14),
        "shuffled-in cards stop being instances"
    );
}

#[test]
fn projection_hides_what_the_player_never_saw() {
    let record = parse(&fixture("solver-opening.json"));
    let mine = game::project(&record, 0).unwrap();
    assert!(game::check(&mine).is_empty(), "{:?}", game::check(&mine));
    let s = end_state(&mine);
    // Prizes are face down, even to their owner.
    assert!(s.players[0].prizes.iter().all(|id| s.print_of(*id).is_none()));
    // Not knowing the prizes, the player no longer knows the deck's exact contents.
    assert!(s.players[0].deck.contents.is_none());
    assert_eq!(s.print_of(15), Some("PRE-9"));

    let theirs = game::project(&record, 1).unwrap();
    assert!(game::check(&theirs).is_empty(), "{:?}", game::check(&theirs));
    assert!(theirs.players[0].decklist.is_none());
    let s = end_state(&theirs);
    // The opponent sees the board and the discard, not the hand.
    assert_eq!(s.print_of(1), Some("PRE-9"));
    assert_eq!(s.print_of(2), Some("30C-126"));
    assert_eq!(
        s.print_of(15),
        Some("PRE-9"),
        "Poké Pad reveals the card it finds"
    );
    assert!(s.players[0].hand.iter().all(|id| s.print_of(*id).is_none()));
}

#[test]
fn projecting_a_player_record() {
    let record = parse(&fixture("ptcgl-game.json"));
    assert_eq!(game::project(&record, 0).unwrap(), record);
    assert!(game::project(&record, 1).is_err());
}

// --- Small records ---

/// A record from a goldfish start (player 0: 10 known cards) and a list of actions.
fn small(actions: Value) -> Record {
    let record = json!({
        "format": "porytools-game", "version": 1, "viewpoint": "all", "source": "handwritten",
        "players": [{}, {}],
        "start": { "players": [
            { "deck": { "count": 10, "contents": [["PRE-9", 4], ["PRE-10", 2], ["MEE-1", 4]] } },
            { "deck": { "count": 0 } }
        ] },
        "nodes": actions.as_array().unwrap().iter().map(|a| json!({ "action": a })).collect::<Vec<_>>(),
    });
    parse(&record.to_string())
}

fn opening() -> Value {
    json!([
        { "type": "chooseFirst", "player": 0, "first": 0, "changes": [] },
        { "type": "openingHand", "player": 0, "changes": [{ "type": "draw", "player": 0, "cards": [
            { "id": 1, "card": "PRE-9" }, { "id": 2, "card": "PRE-9" }, { "id": 3, "card": "PRE-10" },
            { "id": 4, "card": "MEE-1" }] }] },
        { "type": "placeStart", "player": 0, "changes": [
            { "type": "move", "cards": [1], "to": { "zone": "active" } },
            { "type": "move", "cards": [2], "to": { "zone": "bench" } }] },
        { "type": "revealStart", "changes": [{ "type": "reveal", "cards": { "1": "PRE-9", "2": "PRE-9" }, "to": "all" }] },
        { "type": "startTurn", "player": 0, "changes": [] }
    ])
}

fn with(mut actions: Value, more: Value) -> Value {
    actions
        .as_array_mut()
        .unwrap()
        .extend(more.as_array().unwrap().iter().cloned());
    actions
}

fn first_error(actions: Value) -> String {
    let errors = game::check(&small(actions));
    errors.first().map(|e| e.to_string()).unwrap_or_default()
}

#[test]
fn setup_pokemon_are_face_down_until_revealed() {
    let record = small(opening());
    let s = game::fold(&record, Some(2)).unwrap();
    assert!(s.players[0].active.as_ref().unwrap().face_down);
    let s = game::fold(&record, Some(3)).unwrap();
    assert!(!s.players[0].active.as_ref().unwrap().face_down);
    assert!(s.players[0].bench.iter().all(|p| !p.face_down));
}

#[test]
fn evolving_and_benching_clear_conditions() {
    let actions = with(
        opening(),
        json!([{ "type": "attack", "player": 0, "pokemon": 1, "attack": 0, "changes": [
            { "type": "condition", "pokemon": 1, "add": "poisoned" },
            { "type": "condition", "pokemon": 1, "add": "asleep" },
            { "type": "condition", "pokemon": 1, "add": "paralyzed" },
            { "type": "damage", "pokemon": 1, "amount": 30 },
            { "type": "heal", "pokemon": 1, "amount": 50 }] }]),
    );
    let s = end_state(&small(actions.clone()));
    let active = s.players[0].active.as_ref().unwrap();
    assert_eq!(
        active.conditions.rotation,
        Some(game::action::ConditionKind::Paralyzed)
    );
    assert!(active.conditions.poisoned);
    assert_eq!(active.counters, 0, "healing past 0 stops at 0");

    let evolved = with(
        actions.clone(),
        json!([{ "type": "evolve", "player": 0, "card": 3, "onto": 1, "changes": [
            { "type": "move", "cards": [3], "to": { "zone": "stack", "on": 1 } }] }]),
    );
    let s = end_state(&small(evolved));
    let active = s.players[0].active.as_ref().unwrap();
    assert_eq!(active.stack, vec![1, 3]);
    assert_eq!(active.conditions, Default::default());

    let switched = with(
        actions,
        json!([{ "type": "playCard", "player": 0, "card": 4, "changes": [
        { "type": "switch", "player": 0, "bench": 2 }] }]),
    );
    let s = end_state(&small(switched));
    assert_eq!(s.players[0].active.as_ref().unwrap().stack, vec![2]);
    assert_eq!(s.players[0].bench[0].conditions, Default::default());
}

#[test]
fn deck_top_and_shuffle() {
    let actions = with(
        opening(),
        json!([{ "type": "trigger", "player": 0, "card": 1, "changes": [
            { "type": "toDeck", "cards": [3, 4], "pos": "top" },
            { "type": "draw", "player": 0, "cards": [{ "id": 3 }] }] }]),
    );
    let s = end_state(&small(actions.clone()));
    assert_eq!(
        s.players[0].deck.top,
        vec![4],
        "the first listed card ends on top"
    );
    assert!(s.players[0].hand.contains(&3));

    let shuffled = with(
        actions,
        json!([{ "type": "trigger", "player": 0, "card": 1, "changes": [
        { "type": "shuffle", "player": 0 }] }]),
    );
    let s = end_state(&small(shuffled));
    assert!(s.players[0].deck.top.is_empty() && !s.cards.contains_key(&4));
    let energy = s.players[0]
        .deck
        .contents
        .as_ref()
        .unwrap()
        .iter()
        .find(|(p, _)| p == "MEE-1")
        .unwrap()
        .1;
    assert_eq!(energy, 4, "the shuffled-in Energy is back in the known contents");
}

#[test]
fn knock_out_removes_the_pokemon() {
    let actions = with(
        opening(),
        json!([
            { "type": "attachEnergy", "player": 0, "card": 4, "onto": 2, "changes": [
                { "type": "move", "cards": [4], "to": { "zone": "attached", "on": 2 } }] },
            { "type": "knockOut", "pokemon": 2, "changes": [
                { "type": "move", "cards": [2], "to": { "zone": "discard" } },
                { "type": "move", "cards": [4], "to": { "zone": "discard" } }] }
        ]),
    );
    let s = end_state(&small(actions));
    assert!(s.players[0].bench.is_empty());
    assert_eq!(s.players[0].discard, vec![2, 4]);
}

#[test]
fn consistency_errors() {
    let reused = with(
        opening(),
        json!([{ "type": "startTurn", "player": 0, "changes": [
        { "type": "draw", "player": 0, "cards": [{ "id": 1, "card": "PRE-9" }] }] }]),
    );
    assert!(first_error(reused).contains("already in use"));

    let not_in_deck = with(
        opening(),
        json!([{ "type": "startTurn", "player": 0, "changes": [
        { "type": "draw", "player": 0, "cards": [{ "id": 9, "card": "TEF-23" }] }] }]),
    );
    assert!(first_error(not_in_deck).contains("no TEF-23 left"));

    let unknown_face_up = with(
        opening(),
        json!([{ "type": "startTurn", "player": 0, "changes": [
        { "type": "draw", "player": 0, "cards": [{ "id": 9 }] },
        { "type": "move", "cards": [9], "to": { "zone": "discard" } }] }]),
    );
    assert!(first_error(unknown_face_up).contains("face up but unknown"));

    let two_actives = with(
        opening(),
        json!([{ "type": "promote", "player": 0, "pokemon": 2, "changes": [
        { "type": "move", "cards": [2], "to": { "zone": "active" } }] }]),
    );
    assert!(first_error(two_actives).contains("Active Spot is taken"));

    let wrong_reveal = with(
        opening(),
        json!([{ "type": "trigger", "player": 0, "card": 1, "changes": [
        { "type": "reveal", "cards": { "1": "MEE-1" }, "to": "all" }] }]),
    );
    assert!(first_error(wrong_reveal).contains("revealed as MEE-1"));

    let mut too_many = vec![];
    for i in 0..11 {
        too_many.push(json!({ "id": 20 + i }));
    }
    let deck_out = json!([{ "type": "openingHand", "player": 0, "changes": [
        { "type": "draw", "player": 0, "cards": too_many }] }]);
    assert!(first_error(deck_out).contains("deck pool is empty"));
}

#[test]
fn bad_records_are_rejected() {
    let mut v: Value = serde_json::from_str(&fixture("solver-opening.json")).unwrap();
    v["version"] = json!(2);
    assert!(
        Record::from_json(&v.to_string())
            .unwrap_err()
            .message
            .contains("newer")
    );
    v["version"] = json!(1);
    v["nodes"][0]["parent"] = json!(3);
    assert!(Record::from_json(&v.to_string()).is_err());
    v["nodes"][0]["parent"] = json!(null);
    assert!(Record::from_json(&v.to_string()).is_ok());
    v["format"] = json!("something-else");
    assert!(Record::from_json(&v.to_string()).is_err());
}
