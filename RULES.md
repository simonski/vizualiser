RULES.md

This is the set of RULES that explains what to do.

Read this file RULES.md - it tells you how to interact and how to create the software.

Read the DESIGN.md file - it describes the project.

Read the USE_CASES.md - it tells you the different use cases in detail.

## General Rules

- typing "continue" means re-read the RULES, DESIGN and TODO to continue creating and extending the project.
- Maintain a USER_GUIDE.md that is to explain all use cases and functionality.   
- Maintain a README.md such that it explains in simple terms what the project is and how to build it.
- maintain a TODO.md explaining the tasks carried out and to be carried out.

## Git, Testing

- use git
- work in a feature branch using a feature < develop < main and only merge to develop once the feature is complete and all tests pass
- ensure the test suite passes before commiting code
- strive for comprehensive test coverage

## Makefile

- there should be a Makefile (make build clean test)
- `make` on its own should print a usage

