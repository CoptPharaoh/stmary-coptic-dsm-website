# St. Mary Website Rebuild Plan

## Project Goal

Rebuild the church website as a clean, modern, responsive parish website using:

- `index.html`
- `css/style.css`
- `js/main.js`
- image assets from `assets/images`

The original files in `developer-original/` will be used only as reference for layout, content, branding, and behavior. No original code will be copied.

## Original Website Findings

The original site has a strong visual direction but messy implementation:

- The brand is St. Mary Coptic Orthodox Church, Des Moines, Iowa.
- The main colors are deep navy, gold, cream, white, and muted charcoal.
- The header sits over the hero image with a transparent/dark overlay style.
- The homepage uses a large hero, quick feature cards, service/contact info, welcome content, church image, events, and a large footer.
- The About page focuses on St. Mary the Theotokos with a hero, intro card, side navigation, accordion sections, hymn/audio resources, and related About links.
- The JavaScript mainly supports mobile navigation, closing the menu, escape-key behavior, and active side navigation on the St. Mary page.
- The original code contains duplicated CSS/JS, inline styles, embedded base64 images, inconsistent paths, and repeated fixes. The rebuild should replace this with one organized architecture.

## Page Structure

### Primary Homepage: `index.html`

The first approved implementation will build the homepage as a complete one-page experience with anchor sections:

1. Global header
2. Hero
3. Quick feature cards
4. Service/contact information strip
5. Welcome / new visitor section
6. Service highlights
7. Schedule section
8. Upcoming events section
9. Book appointment call-to-action
10. Live stream call-to-action
11. Contact section
12. Footer

The homepage anchors will preserve the original navigation intent:

- `#new-here`
- `#services`
- `#schedule`
- `#events`
- `#book-appointment`
- `#contact`
- `#live-stream`

### Future Interior Pages

The original references additional pages that are not currently part of the clean rebuild files:

- `st-mary-theotokos.html`
- `new-here.html`
- `services.html`
- `schedule.html`
- `events.html`
- `appointment.html`
- `contact.html`
- `live.html`
- About subpages for Pope, priest, and Coptic language

Since the current rebuild files only include the homepage files, these links will be handled as homepage anchors or planned future pages. The header/footer structure will be designed so future pages can reuse the same components.

## Component Structure

### 1. Header Component

Purpose: consistent brand identity and navigation.

Structure:

- `header.site-header`
- brand link with `assets/images/logo-main.png`
- text lockup:
  - St. Mary
  - Coptic Orthodox Church
  - Des Moines, Iowa
- desktop navigation
- Live Stream button
- social links placeholders
- mobile menu button
- mobile drawer/panel

Behavior:

- Desktop: horizontal navigation.
- Tablet/mobile: collapsible menu.
- Menu closes when a link is clicked, backdrop is clicked, escape is pressed, or viewport returns to desktop size.

### 2. Hero Component

Purpose: preserve the original emotional first impression.

Structure:

- Full-width hero with `assets/images/hero-banner.jpeg`
- dark navy overlay for text readability
- parish identity copy:
  - Des Moines, Iowa
  - St. Mary
  - Coptic Orthodox Church
  - A place to belong.
- primary actions:
  - I'm New Here
  - Book Appointment

Responsive behavior:

- Desktop: large cinematic hero with text positioned over image.
- Tablet: tighter header spacing and balanced hero height.
- Mobile: image remains visible, text scales down, actions stack neatly.

### 3. Quick Feature Cards

Purpose: recreate the four-card row from the original homepage.

Cards:

- A Place to Belong
- Worship Together
- Growing in Faith
- Serve & Love

Implementation:

- Reusable `.feature-card` component.
- Use clean CSS icon treatments or simple inline symbols where appropriate.
- Grid layout: 4 columns desktop, 2 columns tablet, 1 column mobile.

### 4. Information Strip

Purpose: immediate practical parish information.

Items:

- Sunday Service: 9:00 AM, Divine Liturgy & Sunday School
- Address: 954 Cummins Pkwy., Des Moines, IA 50312
- Abouna: Fr. Shenouda Bsta, Hegumen Father
- Contact: (515) 981-1621, saintmarydsm@gmail.com

Implementation:

- Reusable `.info-item` component.
- Navy background with gold accents.
- Grid layout: 4 columns desktop, 2 columns tablet, 1 column mobile.

### 5. Main Content Sections

Purpose: replace the original lower card layout with a modern, organized parish layout.

Sections:

- Welcome / Living the Orthodox Faith
- New visitors callout
- Services overview
- Weekly schedule
- Upcoming events
- Appointment CTA
- Live stream CTA
- Contact/location

Implementation:

- Semantic sections with `id` attributes.
- Reusable section headers with kicker, title, and optional intro text.
- Cards used only for repeated items or framed content.
- Balanced desktop grid, stacked mobile layout.

### 6. Events Component

Purpose: preserve the original upcoming events functionality visually.

Structure:

- `.event-card`
- date badge
- event title
- time/location note
- View All Events link or CTA

Initial placeholder events can match the original reference:

- Sunday School Activities
- Youth Meeting
- Bible Study

### 7. Footer Component

Purpose: preserve the professional parish footer from the original.

Structure:

- logo/brand column
- short welcome message
- quick links
- service links
- social/live links
- contact info
- copyright line:
  - Glory be to God forever.

Responsive behavior:

- Multi-column desktop.
- Two-column tablet.
- Single-column mobile.

## Navigation Structure

### Desktop Navigation

Recommended nav order:

1. Home
2. About
3. I'm New Here
4. Services
5. Schedule
6. Events
7. Book Appointment
8. Contact
9. Live Stream

Implementation detail:

- `Home` links to `index.html`.
- `About` can point to a future About page or temporary About section/placeholder.
- Homepage section links use anchors.
- `Live Stream` is styled as the primary header action.

### Mobile Navigation

The mobile menu will include the same links in a vertical drawer:

- Home
- About
- I'm New Here
- Services
- Schedule
- Events
- Book Appointment
- Contact
- Live Stream

Accessibility:

- The menu button will use `aria-expanded`.
- The drawer will use `aria-label`.
- Escape key closes the menu.
- Focus and hover states will be visible.

## Homepage Layout

### Desktop Layout

1. Transparent/navy header over hero.
2. Hero fills the first viewport visually with the church image and brand message.
3. Quick cards overlap or sit directly below hero for continuity.
4. Navy information strip gives service, address, priest, and contact details.
5. Main content grid:
   - welcome/new visitor content
   - church/St. Mary image feature
   - upcoming events panel
6. Additional full-width sections for services, schedule, appointment, live stream, and contact.
7. Large navy footer with gold accents.

### Tablet Layout

1. Header reduces spacing.
2. Navigation switches to mobile drawer near the tablet breakpoint.
3. Quick cards and info items become two-column grids.
4. Main content becomes a single column or two-column layout depending on available width.

### Mobile Layout

1. Compact header with logo and menu button.
2. Hero text remains readable over the image.
3. Buttons stack vertically.
4. Cards stack one per row.
5. Contact details and appointment CTA become easy tap targets.
6. Footer becomes single-column with clear spacing.

## Asset Usage

Use only assets from `assets/images`:

- `logo-main.png` for brand/logo usage.
- `hero-banner.jpeg` for homepage hero.
- `hero-st-mary.PNG` for St. Mary/About visual references or secondary image sections.
- `bg-cross-pattern.png` as a subtle page texture if it supports readability.
- `pope-tawadros.png` reserved for future About/Pope page content.

The current rebuild references `assets/images/hero-bg-final.jpeg`, but that file does not exist in the clean asset folder. The rebuild should remove that missing reference and use the available images above.

## CSS Architecture

`css/style.css` will be organized into clear sections:

1. CSS variables
2. Base/reset styles
3. Typography
4. Layout utilities
5. Buttons and links
6. Header/navigation
7. Hero
8. Cards/components
9. Homepage sections
10. Footer
11. Responsive breakpoints

Brand tokens:

- Navy: deep church/navy tone
- Gold: warm liturgical accent
- Cream: page background
- White: content surfaces
- Charcoal/muted gray: readable text

## JavaScript Architecture

`js/main.js` will stay lightweight and modular:

- `initMobileMenu()`
- `initSmoothAnchorClose()`
- optional `initHeaderState()` if a sticky/transparent header behavior is approved

No duplicated mobile menu code. No inline JavaScript.

## Accessibility and Quality Goals

- Semantic landmarks: `header`, `nav`, `main`, `section`, `article`, `aside`, `footer`.
- Meaningful image alt text.
- Proper button elements for actions that toggle UI.
- Adequate color contrast.
- Responsive text and spacing.
- No horizontal overflow on mobile.
- Clean links and tap targets.
- No copied legacy code, no base64 images, no inline style blocks.

## Approval Checkpoint

After this plan is approved, implementation will proceed by editing:

- `index.html`
- `css/style.css`
- `js/main.js`

No implementation changes will be made before approval.
