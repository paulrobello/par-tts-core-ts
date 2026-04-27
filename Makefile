.PHONY: install lint typecheck test build check checkall pack-dry-run pre-commit-install pre-commit-run publish

install:
	bun install --frozen-lockfile

lint:
	bun run lint

typecheck:
	bun run typecheck

test:
	bun run test

build:
	bun run build

check:
	bun run check

checkall: check pack-dry-run

pack-dry-run:
	npm pack --dry-run --json

pre-commit-install:
	pre-commit install

pre-commit-run:
	pre-commit run --all-files

publish:
	npm publish --access public
