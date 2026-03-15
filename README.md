# rpeck-monkeyscripts

Collection of Violentmonkey/Tampermonkey userscripts.

## Installation

1. Install [Violentmonkey](https://violentmonkey.github.io/) (or Tampermonkey) in your browser
2. Click any install link below, or navigate to a `.user.js` file and click "Raw"

## Scripts

### LinkedIn Post Titles

Replaces generic LinkedIn post tab titles like "(99+) Post | LinkedIn" with meaningful ones:

`LinkedIn Post - Paul Iusztin - Palantir built a $400B empire on ontology-first AI systems...`

**[Install](https://github.com/rpeck/rpeck-monkeyscripts/raw/main/linkedin-post-titles/linkedin-post-titles.user.js)**

Uses a fallback chain for topic extraction:
1. JSON-LD headline (LinkedIn's own summary)
2. Post body text (first ~80 chars)
3. Hashtags from post
