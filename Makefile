.PHONY: all check ietf paper paper-docker paper-arxiv paper-arxiv-docker w3c w3c-check

all: check ietf w3c-check paper

check:
	./scripts/check.sh

ietf:
	./scripts/render-ietf.sh

paper:
	./scripts/build-paper.sh

paper-docker:
	./scripts/build-paper-in-docker.sh

paper-arxiv: paper
	./scripts/package-arxiv.sh

paper-arxiv-docker: paper-docker
	./scripts/package-arxiv.sh

w3c:
	python3 -m http.server 8000 --directory w3c-cg

w3c-check:
	./scripts/check-w3c.sh
