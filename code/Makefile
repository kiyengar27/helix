.PHONY: help build test preview policy validate-server plan verify deploy

help:
	@echo 'build   Local type-checks and tests; no credentials or network'
	@echo 'preview Build and render the outgoing transaction locally'
	@echo 'plan    Build, then validate and compare with staging (no writes)'
	@echo 'verify  Build, then require all expected staging resources with no drift'
	@echo 'policy  Generate scoped AccessPolicy JSON locally'
	@echo 'validate-server  Validate compiled resources without persistence'
	@echo 'deploy  Apply previously saved/reviewed reports/plan.json; verify internally'

build:
	npm run build

test:
	npm test

preview: build
	npm run preview

policy: build
	npm run policy

validate-server: build
	npm run validate:server

plan: build
	npm run plan

verify: build
	npm run verify

deploy: build
	npm run apply
