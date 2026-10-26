check:
	actionlint
	npx tsc
	node --test tests/*.test.ts
