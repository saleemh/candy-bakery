# Candy Bakery

A cozy, desktop-friendly browser game inspired by counter-service sims. Customers arrive and order candy or cake combinations. Assemble their treats on the tray and serve before their patience runs out.

## Play

Open `index.html` in a desktop browser (Chrome, Edge, Safari, or Firefox). No build step or backend required.

## Gameplay

- Customers request a combo of ingredients.
- Orders are either "exact" or "at least" for each listed ingredient.
- Click bins to add items to your assembly tray, then press Serve.
- Earn coins based on correctness and remaining patience.
- A day lasts 2 minutes, after which you get a summary screen and can proceed to the next day.

### Controls

- Click bins to add items to the tray
- Buttons: Undo, Clear, Serve
- Keyboard shortcuts:
  - Enter: Serve
  - Backspace: Undo
  - C: Clear
  - 1–0: Add from bins (left-to-right)
  - P: Pause/Resume

### Ingredients

Candy: Berry Pop, Lemon Drop, Lime Slice, Grape Gem, Blueberry, Choco Bite, Vanilla Fudge, Cola Chew, Bubble Gum, Mint Leaf.

Cake & Toppings: Vanilla Cake, Chocolate Cake, Red Velvet Cake, Vanilla Frosting, Chocolate Frosting, Strawberry Frosting, Rainbow Sprinkles, Cherry, Choco Chips.

## Architecture

Vanilla HTML/CSS/JS. No frameworks or dependencies.

- `index.html`: Three screens (storefront, gameplay, summary) and UI structure.
- `css/styles.css`: Visuals and layout. Uses CSS variables for palette and small responsive adjustments.
- `js/game.js`: Game loop and logic.
  - State: day/time/coins, current order, tray, patience, timers, pause state.
  - Generators: Builds random orders with either `exact` or `atleast` logic.
  - Evaluation: Compares tray counts vs required counts per mode.
  - Flow: Start day → customers spawn → patience timer → serve → score → end-of-day summary.
  - Pause/Resume: Freezes all timers and customer spawning while allowing tray assembly.

## Development

Everything runs locally by opening `index.html`. Edit files and refresh.

## License

MIT


