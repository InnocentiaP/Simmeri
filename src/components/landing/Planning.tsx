import { SimiSpot } from "./SimiSpot";
import pancakesImg from "/images/simmeri/banana-oat-pancakes.jpg?url";
import tomatoImg from "/images/simmeri/roasted-tomato-soup.jpg?url";
import curryImg from "/images/simmeri/vegetable-curry.jpg?url";
import pastaImg from "/images/simmeri/creamy-mushroom-pasta.jpg?url";
import salmonImg from "/images/simmeri/lemon-garlic-salmon.jpg?url";

const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const meals = [
  { day: 0, title: "Overnight oats", img: pancakesImg, ready: true },
  { day: 1, title: "Lentil soup", img: tomatoImg, ready: true },
  { day: 2, title: "Miso eggplant", img: curryImg, ready: false },
  { day: 4, title: "Mushroom pasta", img: pastaImg, ready: true },
  { day: 5, title: "Weekend brunch", img: salmonImg, ready: true },
];

const ingredients = [
  { name: "Tomato", state: "Good", tone: "bg-sage/30 text-olive-deep" },
  { name: "Egg", state: "Running low", tone: "bg-caramel/25 text-caramel" },
  { name: "Milk", state: "Good", tone: "bg-sage/30 text-olive-deep" },
  { name: "Carrot", state: "Out of stock", tone: "bg-terracotta/20 text-terracotta" },
  { name: "Miso paste", state: "Good", tone: "bg-sage/30 text-olive-deep" },
];

export function Planning() {
  return (
    <section id="planning" aria-labelledby="planning-title" className="py-24">
      <div className="mx-auto max-w-6xl px-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-olive-deep">
          Meal planning
        </p>
        <h2
          id="planning-title"
          className="max-w-2xl font-display text-4xl leading-[1.05] tracking-tight text-coffee md:text-5xl"
        >
          A gentler week, one meal slot at a time.
        </h2>

        <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-[1.4fr_1fr]">
          {/* Week board */}
          <div className="paper-card overflow-hidden p-6">
            <div className="flex items-center justify-between">
              <p className="font-hand text-2xl text-olive-deep">This week</p>
              <span className="rounded-full bg-cream-deep px-3 py-1 text-xs text-cocoa">
                Nov 4 &ndash; 10
              </span>
            </div>
            <div className="mt-4 grid grid-cols-7 gap-2">
              {days.map((d, i) => (
                <div key={d} className="rounded-2xl border border-border/60 bg-cream/50 p-2">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-cocoa/60">
                    {d}
                  </p>
                  <div className="mt-2 space-y-2">
                    {meals
                      .filter((m) => m.day === i)
                      .map((m) => (
                        <div
                          key={m.title}
                          className="overflow-hidden rounded-xl border border-border/50 bg-background text-coffee"
                        >
                          <img
                            src={m.img}
                            alt={m.title}
                            loading="lazy"
                            width={200}
                            height={140}
                            className="h-10 w-full object-cover"
                          />
                          <div className="flex items-center justify-between gap-1 p-1.5">
                            <span className="truncate text-[10px] font-medium leading-tight">
                              {m.title}
                            </span>
                            <span
                              className={`h-1.5 w-1.5 flex-none rounded-full ${
                                m.ready ? "bg-olive-deep" : "bg-caramel"
                              }`}
                              aria-label={m.ready ? "Ready to cook" : "Needs 1 item"}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-5 flex items-center gap-3 rounded-2xl bg-cream/60 p-3">
              <SimiSpot pose="tip" size={56} alt="Simi with a helpful tip" />
              <p className="text-sm text-cocoa/85">
                Only <b>3 items</b> to buy for this week. A little planning, a much calmer
                week.
              </p>
            </div>
          </div>

          {/* Kitchen inventory mock */}
          <div className="paper-card p-6">
            <div className="flex items-center justify-between">
              <p className="font-hand text-2xl text-olive-deep">Kitchen</p>
              <button
                type="button"
                className="rounded-full border border-border bg-cream px-3 py-1 text-xs text-cocoa"
              >
                Add ingredient
              </button>
            </div>
            <ul className="mt-4 space-y-2">
              {ingredients.map((i) => (
                <li
                  key={i.name}
                  className="flex items-center justify-between rounded-2xl border border-border/60 bg-background p-3"
                >
                  <span className="font-medium text-coffee">{i.name}</span>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${i.tone}`}>
                    {i.state}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
