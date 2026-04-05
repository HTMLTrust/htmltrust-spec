flowchart TD
    A[Author] -->|Manage Keys| B(Web Browser)
    A[Author] -->|Author Content| C(CMS)
    B -->|Obtain Public Key| C
    C -->|Request Signature| B
    C -->|Deliver| P(Pages with Signed Blocks)
    P -->|Viewed| Br(Viewer's Web Browser)
    P -->|Crawled| Cr(Crawler)
    Br -->|Validate| Val(Validation Status)
    Cr -->|Validate & Extract Articles| Researcher(Researcher)
    C -->|Publish Keys & Hashes| Dir(Directories)
    Br -->|Query for Bad Keys| Dir
    Researcher -->|Mark Bad Keys| Dir