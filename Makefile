.PHONY: prepare check test

prepare:
	npx oxfmt
	npx oxlint --fix

check:
	actionlint
	npx tsc
	npx oxlint --deny-warnings
	npx oxfmt --check

test:
	node --test tests/*.test.ts
