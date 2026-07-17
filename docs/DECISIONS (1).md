# Design Decisions — Klypup

### Which option did you choose and why?

i chose the option B, which is the market price stimulator, this project seemed interesting to me as I am also running an ecommerce story, just for a hobby, and this is the problem that I face da to day to keep myself updated with the competitor price so that I can modify my prices, this idea aligned with my problem too, and i thought brainstorming in this direction would teach me more about the market behaviour.

### Why this tech stack? What alternatives did you consider?

Next.js + Express + PostgreSQL/Prisma is my day-to-day stack, so I could move fast without fighting the tools. Considered Next.js API routes instead of a separate backend, and Mongo instead of Postgres as alternatives but for this task I thought an SQL database would be more suitable than a noSQL one. Kept Express separate to cleanly isolate the AI orchestrator, scheduler, and tenant logic from the frontend; kept Postgres because the data (orgs, users, products, price history) is relational.

### How did you approach multi-tenancy? What pattern did you use and why?

All main tables (User, Product, Recommendation, AuditLog) carry an org\_id foreign key.It is cost-effective and highly manageable compared to spinning up a database per customer (physical isolation).We built a custom Express middleware tenantScope.ts. Once the user is authenticated via JWT, the middleware extracts their orgId and injects it into req.orgId. Every database query in the controllers is forced to scope by this ID, ensuring no data leaks occur between organizations.



#### How did you design the AI integration? What prompt engineering decisions did you make?



Split reasoning into 5 sequential agents (market intel → demand → inventory/cost → pricing strategy → execution/compliance) instead of one big prompt, so each output is narrow, structured, and independently debuggable.

Instructed the LLM agents to write out their "reasoning" step-by-step before returning calculations, which significantly improved mathematical accuracy.

&#x20;Each agent only gets the data relevant to their role (e.g. the compliance agent doesn't see competitor prices, only margins and costs) to prevent hallucinations.

### What trade-offs did you make given the 5-day timeline?

Mock data: Instead of building complex OAuth integrations with Shopify or WooCommerce, we simulated storefront price updates using a mock endpoint. Combined Tailwind CSS with styled inline configurations for smaller controls to avoid setting up heavy component library packages.

kept only few items in inventory, to speed up development clarity.

### What would you improve with 2 more weeks?

With 2 more weeks, i would integrate some real market api and explore some better LLMs for the task, also for deployment I would containerize the application through docker, which is still pending. Also to save token costs, I would implement some caching mechanism for the LLM output so that the API does not get hit if the market condition is not changing, this would save us much on LLM costs.

Also i would improve and reseach more on the prompts as there is a minor issue in json formatting that the agent responds with.


### What was the hardest part and how did you solve it?

Hardest part: Keeping the multi-agent AI pipeline fast and reliable, initially Running 5 LLM calls in sequence originally took up to 15 seconds, and a single API timeout would crash the entire run.

I restructured the orchestrator into a hybrid execution flow. By running the data-gathering agents (Market, Demand, Inventory) in parallel using Promise.all, we cut total orchestrator latency by 60%.

Each agent's output is saved to the database on-the-fly. If an agent fails, the run can be resumed later without re-running (and paying for) the previous successful LLM steps.

