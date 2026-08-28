FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      biber \
      cm-super \
      texlive-bibtex-extra \
      texlive-fonts-recommended \
      texlive-fonts-extra \
      texlive-latex-extra \
      texlive-latex-recommended \
 && apt-get clean \
 && find /var/lib/apt/lists -mindepth 1 -delete

WORKDIR /repo
ENTRYPOINT ["/repo/scripts/build-paper.sh"]
