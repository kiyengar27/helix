.PHONY: help build test preview plan verify deploy

help:
	@echo 'build   Local type-checks and tests; no credentials or network'
	@echo 'preview Build and render the outgoing transaction locally'
	@echo 'plan    Build, then validate and compare with staging (no writes)'
	@echo 'verify  Build, then require all expected staging resources with no drift'
	@echo 'deploy  Build, validate/plan, apply, and verify staging'

build:
	npm run build

test:
	npm test

preview: build
	npm run preview

plan: build
	npm run plan

verify: build
	npm run verify

deploy: build
	npm run apply
	npm run verify
