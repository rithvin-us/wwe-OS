# Platform · Workflow

Generic workflow and approval engine: definitions, states, transitions,
approval chains, escalation, SLA timers. Modules define workflows declaratively;
the engine executes them.

- Owns: workflow definitions, instances, transitions, approval routing.
- Does not own: the business meaning of any workflow (that is module territory).
