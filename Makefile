.PHONY: all check ietf paper w3c w3c-check

all: check ietf w3c-check paper

check:
	./scripts/check.sh

ietf:
	./scripts/render-ietf.sh

paper:
	./scripts/build-paper.sh

w3c:
	python3 -m http.server 8000 --directory w3c-cg

w3c-check:
	./scripts/check-w3c.sh
