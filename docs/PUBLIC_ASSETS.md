# Public asset versions

Public HTML uses content hashes in the URLs for the shared stylesheet, navigation
script, and announcements script. This prevents a cached older asset from being
paired with newly edited HTML. No application framework or production server
configuration is required.

After changing `css/style.css`, `js/main.js`, or `js/public-content.js`, run:

```sh
node scripts/version-public-assets.mjs --write
node scripts/version-public-assets.mjs
```

The first command updates only the matching asset attributes in root-level public
HTML pages. The second is a read-only consistency check and exits nonzero if any
references need updating. Neither command touches developer-original, admin files,
Supabase configuration, data, or security settings.

New content loaded from Supabase does not require asset version updates.

## Initial repair scope

The following 50 root-level public HTML pages received asset-reference updates.
Only `index.html` also received markup changes (explicit 24px icon dimensions).
Existing uncommitted content changes were preserved.

```text
about-welcome.html          about.html
announcements.html          baptism.html
bible-studies.html          book-appointment.html
books.html                  chrismation.html
church-fathers.html         church-history.html
clergy.html                 confession.html
contact.html                coptic-language.html
deacons.html                divine-liturgy.html
ecumenical-councils.html     eucharist.html
events.html                 family-ministry.html
faq.html                    give.html
holy-scripture.html         hymns-audio.html
index.html                  liturgical-calendar.html
livestream.html             marriage.html
ministries.html             mysteries.html
new-visitor-guide.html      oriental-orthodox-family.html
our-faith.html              our-patron-saint.html
our-pope.html               patron-saint.html
priesthood.html             repentance-confession.html
repentance.html             resources.html
sermons.html                service-opportunities.html
st-mary-theotokos.html      sunday-school.html
theology.html               unction-sick.html
what-we-believe.html        worship.html
young-adults.html           youth.html
```
