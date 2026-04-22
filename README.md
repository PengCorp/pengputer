# Setup

`npm install`

# Developing

## Python

Some parts require running Python scripts. 

- Create venv with `python3 -m venv .venv`. 
- Install requirements with `pip install -r requirements.txt`
- Update requirements with `pip freeze > requirements.txt`

## Node

- To use correct version of Node `nvm use` or refer to `.nvmrc` and ensure correct version is available when running `node --version`.

## Running dev version

`npm run dev`

## Code conventions

Private methods are prefixed by `_`. Internal methods are prefixed with `__`. Internal methods are public but must only be accessed in the same "module".

# Credits

This couldn't have happened without contributions from:

- Boons
- Jack
- Nashiora/Local
- NicNic
- Strace
- Strawberry

Thank you 🍓
