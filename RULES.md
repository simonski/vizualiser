RULES.md

This is the set of RULES that explains what to do.

Read this file RULES.md - it tells you how to interact and how to create the software.
Read the DESIGN_xxx.md files - they explain what to build.
Read the USE_CASES.md - it tells you the different use cases in detail.

## General Rules

- "continue" means re-read the RULES, DESIGN and TODO to continue creating and extending the project.
- read the DESIGN.md as the instructions
- Maintain a USER_GUIDE.md that is to explain all use cases and functionality.   
- Maintain a README.md such that it explains in simple terms what the project is and how to build it.
- maintain a TODO.md explaining the tasks carried out and to be carried out

## Git, Testing

- use git
- work in a feature branch using a feature < develop < main and only merge to develop once the feature is complete and all tests pass
- ensure the test suite passes before commiting code
- strive for comprehensive test coverage
- split teesting into unit (fast) and integration (slower)
    - unit testing is intended to be fast and performed in isolation
    - integration testing is to use components such as client<->server, or website<->server
- I will use `binary`, `tool` and `$TOOL` to indicate the single binary that you create - the actual name of the binary will be in the top of the DESIGN.md document

## Makefile

- there should be a Makefile (make build clean test)
- `make` on its own should print a usage

