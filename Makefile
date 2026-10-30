.PHONY: check test

check:
	actionlint
	npx tsc

test:
	node --test tests/*.test.ts
