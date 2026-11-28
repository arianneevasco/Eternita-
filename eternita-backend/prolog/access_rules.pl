% PEOPLE


% Maria is the owner of the example diary entries.
person(maria).

% Ana is a beneficiary connected to Maria through protocols.
person(ana).

% Carlos is a registered person with no protocol.
person(carlos).


% ENTRIES AND OWNERS

% Diary entries used for initial testing.
entry(entry_1).
entry(entry_2).
entry(entry_3).

% Maria owns all example diary entries.
owner(maria, entry_1).
owner(maria, entry_2).
owner(maria, entry_3).


% ENTRY TAGS


% Tags describe the general topic of an entry.
tag(entry_1, family).
tag(entry_1, travel).
tag(entry_2, birthday).
tag(entry_3, memories).


% PROTOCOLS


% A protocol is a connection between an owner and a beneficiary.
protocol(protocol_1).
protocol(protocol_2).
protocol(protocol_3).

% Protocol 1 connects Maria and Ana.
protocol_for(protocol_1, maria, ana).

% Protocol 2 connects Maria and Ana.
protocol_for(protocol_2, maria, ana).

% Protocol 3 connects Maria and Ana.
protocol_for(protocol_3, maria, ana).


% GRANTS


% Ana can know that Entry 1 exists.
grant(protocol_1, entry_1, existence).

% Ana can see limited information about Entry 2.
grant(protocol_2, entry_2, summary).

% Ana can read the complete contents of Entry 3.
grant(protocol_3, entry_3, full).


% ACCESS RULES


% Existence access:
% A person can know that an entry exists.
access(Person, Entry, existence) :-
    person(Person),
    entry(Entry),
    protocol_for(Protocol, Owner, Person),
    owner(Owner, Entry),
    grant(Protocol, Entry, existence).


% Summary access:
% A person can see limited information about an entry.
access(Person, Entry, summary) :-
    person(Person),
    entry(Entry),
    protocol_for(Protocol, Owner, Person),
    owner(Owner, Entry),
    grant(Protocol, Entry, summary).


% Full access:
% A person can read the complete contents of an entry.
access(Person, Entry, full) :-
    person(Person),
    entry(Entry),
    protocol_for(Protocol, Owner, Person),
    owner(Owner, Entry),
    grant(Protocol, Entry, full).


% DENY-BY-DEFAULT RULE


% A person is denied access when none of the access levels
% can be proven for the requested entry.
deny_access(Person, Entry) :-
    \+ access(Person, Entry, existence),
    \+ access(Person, Entry, summary),
    \+ access(Person, Entry, full).


% HELPER RULES


% Helper rule for checking existence access.
can_view_existence(Person, Entry) :-
    access(Person, Entry, existence).


% Helper rule for checking summary access.
can_view_summary(Person, Entry) :-
    access(Person, Entry, summary).


% Helper rule for checking full access.
can_view_full(Person, Entry) :-
    access(Person, Entry, full).