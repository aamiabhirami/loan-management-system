type PageSkeletonVariant =
  | "workspace"
  | "home"
  | "login"
  | "dashboard"
  | "loans"
  | "customers"
  | "team"
  | "groups"
  | "collections"
  | "products"
  | "audit"
  | "reports"
  | "documents"
  | "expenses"
  | "payroll"
  | "settings"
  | "receipt";

function Bar({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse motion-reduce:animate-none rounded-md bg-[#e7ede8] ${className}`} />;
}

function Heading({ action = false }: { action?: boolean }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 flex-1 space-y-3">
        <Bar className="h-3 w-24" />
        <Bar className="h-8 w-56 max-w-full" />
        <Bar className="h-4 w-[min(100%,32rem)]" />
      </div>
      {action && <Bar className="h-10 w-40" />}
    </div>
  );
}

function Rows({ count = 5 }: { count?: number }) {
  return (
    <div className="divide-y divide-[#edf1ee]">
      {Array.from({ length: count }, (_, index) => (
        <div className="flex items-center gap-4 px-5 py-4" key={index}>
          <Bar className="h-9 w-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Bar className="h-3 w-1/3" />
            <Bar className="h-3 w-2/3" />
          </div>
          <Bar className="hidden h-7 w-20 sm:block" />
        </div>
      ))}
    </div>
  );
}

function Table({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#e7ece8] bg-white">
      <div className="flex gap-4 border-b border-[#edf1ee] bg-[#f8faf8] px-5 py-3">
        {Array.from({ length: columns }, (_, index) => <Bar className="h-3 flex-1" key={index} />)}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div className="flex gap-4 border-b border-[#f0f3f0] px-5 py-4 last:border-0" key={row}>
          {Array.from({ length: columns }, (_, column) => <Bar className="h-4 flex-1" key={column} />)}
        </div>
      ))}
    </div>
  );
}

function Metrics({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid gap-4 sm:grid-cols-2 ${count === 4 ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}>
      {Array.from({ length: count }, (_, index) => (
        <div className="rounded-2xl border border-[#e7ece8] bg-white p-5" key={index}>
          <Bar className="h-3 w-28" />
          <Bar className="mt-4 h-7 w-36 max-w-full" />
          <Bar className="mt-3 h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <section className={`overflow-hidden rounded-2xl border border-[#e7ece8] bg-white ${className}`}>{children}</section>;
}

function PageContent({ variant }: { variant: Exclude<PageSkeletonVariant, "workspace" | "home" | "login"> }) {
  switch (variant) {
    case "dashboard":
      return (
        <>
          <Heading action />
          <Panel className="p-4"><Bar className="h-12 w-full rounded-xl" /></Panel>
          <Metrics />
          <div className="grid gap-5 xl:grid-cols-2">
            <Panel className="p-5"><Bar className="h-5 w-40" /><Bar className="mt-6 h-56 w-full" /></Panel>
            <Panel className="p-5"><Bar className="h-5 w-40" /><div className="mt-6 space-y-4">{Array.from({ length: 3 }, (_, index) => <Bar className="h-10 w-full" key={index} />)}</div></Panel>
          </div>
        </>
      );
    case "loans":
      return (
        <>
          <Heading />
          <Panel className="mb-5 p-5"><Bar className="h-5 w-56" /><div className="mt-5 grid gap-3 sm:grid-cols-3"><Bar className="h-10" /><Bar className="h-10" /><Bar className="h-10" /></div></Panel>
          <Panel><div className="flex justify-between border-b border-[#edf1ee] p-5"><Bar className="h-5 w-40" /><Bar className="h-9 w-56" /></div><Rows /></Panel>
        </>
      );
    case "customers":
      return (
        <>
          <Heading action />
          <Panel><div className="flex flex-wrap justify-between gap-3 border-b border-[#edf1ee] p-5"><Bar className="h-5 w-36" /><Bar className="h-9 w-56" /></div><Rows /></Panel>
        </>
      );
    case "team":
      return (
        <>
          <Heading action />
          <Panel className="mb-5 p-5"><Bar className="h-5 w-48" /><div className="mt-5 grid gap-3 sm:grid-cols-2"><Bar className="h-10" /><Bar className="h-10" /><Bar className="h-10" /><Bar className="h-10" /></div></Panel>
          <Panel><div className="border-b border-[#edf1ee] p-5"><Bar className="h-5 w-40" /></div><Rows /></Panel>
        </>
      );
    case "groups":
      return (
        <>
          <Heading />
          <Panel className="mb-5 p-5"><Bar className="h-5 w-52" /><Bar className="mt-3 h-4 w-72 max-w-full" /></Panel>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => <Panel className="p-4" key={index}><Bar className="h-5 w-2/3" /><Bar className="mt-3 h-4 w-1/2" /><Bar className="mt-6 h-10 w-full" /><Bar className="mt-4 h-8 w-full" /></Panel>)}
          </div>
        </>
      );
    case "collections":
      return (
        <>
          <Heading />
          <div className="grid gap-5 xl:grid-cols-[1fr_1.2fr]">
            <Panel className="p-5"><Bar className="h-5 w-48" /><div className="mt-5 space-y-4">{Array.from({ length: 5 }, (_, index) => <Bar className="h-10 w-full" key={index} />)}</div><Bar className="mt-5 h-10 w-40" /></Panel>
            <Panel><div className="border-b border-[#edf1ee] p-5"><Bar className="h-5 w-40" /></div><Rows /></Panel>
          </div>
        </>
      );
    case "products":
      return (
        <>
          <Heading action />
          <Panel className="mb-5 p-5"><Bar className="h-5 w-48" /><div className="mt-5 grid gap-3 sm:grid-cols-2"><Bar className="h-10" /><Bar className="h-10" /><Bar className="h-10" /><Bar className="h-10" /></div></Panel>
          <div className="grid gap-4 lg:grid-cols-2">{Array.from({ length: 4 }, (_, index) => <Panel className="p-5" key={index}><Bar className="h-5 w-1/2" /><Bar className="mt-4 h-4 w-2/3" /><div className="mt-6 grid grid-cols-3 gap-3"><Bar className="h-12" /><Bar className="h-12" /><Bar className="h-12" /></div></Panel>)}</div>
        </>
      );
    case "audit":
      return (
        <>
          <Heading />
          <Panel className="mb-5 p-5"><div className="flex flex-wrap gap-3"><Bar className="h-9 w-56" /><Bar className="h-9 w-40" /></div></Panel>
          <Table rows={8} columns={5} />
        </>
      );
    case "reports":
      return (
        <>
          <Heading />
          <Metrics />
          <Panel className="p-5"><Bar className="h-5 w-48" /><Bar className="mt-5 h-64 w-full" /></Panel>
          <Panel className="p-5"><Bar className="h-5 w-64 max-w-full" /><Bar className="mt-4 h-14 w-full" /></Panel>
        </>
      );
    case "documents":
      return (
        <>
          <Heading />
          <Panel className="mb-5 p-5"><Bar className="h-5 w-52" /><div className="mt-5 grid gap-3 sm:grid-cols-2"><Bar className="h-10" /><Bar className="h-10" /><Bar className="h-24 sm:col-span-2" /></div><Bar className="mt-4 h-10 w-40" /></Panel>
          <Panel><div className="border-b border-[#edf1ee] p-5"><Bar className="h-5 w-44" /></div><Rows /></Panel>
        </>
      );
    case "expenses":
      return (
        <>
          <Heading />
          <Panel className="mb-5 p-5"><Bar className="h-5 w-48" /><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Bar className="h-10" /><Bar className="h-10" /><Bar className="h-10" /><Bar className="h-10" /><Bar className="h-10" /></div><Bar className="mt-4 h-10 w-40" /></Panel>
          <Panel><div className="border-b border-[#edf1ee] p-5"><Bar className="h-5 w-40" /></div><Rows /></Panel>
        </>
      );
    case "payroll":
      return (
        <>
          <Heading />
          <Metrics count={3} />
          <Panel className="my-5 p-5"><Bar className="h-5 w-48" /><div className="mt-5 grid gap-3 sm:grid-cols-3"><Bar className="h-10" /><Bar className="h-10" /><Bar className="h-10" /><Bar className="h-10" /><Bar className="h-10" /><Bar className="h-10" /></div><Bar className="mt-4 h-10 w-40" /></Panel>
          <Panel><div className="border-b border-[#edf1ee] p-5"><Bar className="h-5 w-40" /></div><Rows /></Panel>
        </>
      );
    case "settings":
      return (
        <>
          <Heading />
          <Panel className="max-w-3xl p-5 sm:p-8"><Bar className="h-5 w-48" /><div className="mt-6 grid gap-4 sm:grid-cols-2"><Bar className="h-11" /><Bar className="h-11" /><Bar className="h-11" /><Bar className="h-11" /></div><Bar className="mt-6 h-10 w-36" /></Panel>
        </>
      );
    case "receipt":
      return (
        <div className="mx-auto max-w-2xl">
          <div className="mb-5 flex justify-between"><Bar className="h-10 w-40" /><Bar className="h-10 w-32" /></div>
          <Panel className="p-5 sm:p-8"><div className="flex justify-between border-b border-dashed border-[#dfe8e1] pb-6"><Bar className="h-8 w-52" /><Bar className="h-7 w-20" /></div><Bar className="mt-7 h-24 w-full" /><div className="mt-7 grid gap-5 sm:grid-cols-2">{Array.from({ length: 6 }, (_, index) => <div className="space-y-2" key={index}><Bar className="h-3 w-24" /><Bar className="h-4 w-40" /></div>)}</div><Bar className="mt-8 h-40 w-full" /></Panel>
        </div>
      );
  }
}

export default function PageSkeleton({ variant }: { variant: PageSkeletonVariant }) {
  if (variant === "home") {
    return (
      <main aria-busy="true" className="grid min-h-screen place-items-center bg-[#f5f7f5]">
        <div role="status" className="flex flex-col items-center gap-4">
          <span className="sr-only">Loading Mitra</span>
          <Bar className="h-12 w-12 rounded-xl" />
          <Bar className="h-4 w-28" />
        </div>
      </main>
    );
  }

  if (variant === "login") {
    return (
      <main aria-busy="true" className="grid min-h-screen bg-[#f4f7f6] lg:grid-cols-[1fr_1fr]">
        <section aria-hidden="true" className="hidden flex-col justify-between bg-[#102f2a] px-16 py-14 lg:flex">
          <Bar className="h-11 w-36 bg-white/10" />
          <div className="max-w-xl space-y-5">
            <Bar className="h-7 w-56 rounded-full bg-white/10" />
            <Bar className="h-14 w-full bg-white/10" />
            <Bar className="h-5 w-4/5 bg-white/10" />
          </div>
          <Bar className="h-4 w-72 bg-white/10" />
        </section>
        <section className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
          <div className="w-full max-w-[420px]" role="status">
            <span className="sr-only">Loading sign-in page</span>
            <Bar className="mb-10 h-10 w-32 lg:hidden" />
            <Bar className="h-4 w-28" /><Bar className="mt-4 h-9 w-56" /><Bar className="mt-3 h-4 w-full" />
            <div className="mt-8 space-y-5"><Bar className="h-11 w-full" /><Bar className="h-11 w-full" /><Bar className="h-11 w-full" /></div>
            <Bar className="mx-auto mt-8 h-4 w-64" />
          </div>
        </section>
      </main>
    );
  }

  if (variant === "workspace") {
    return (
      <div aria-busy="true" className="min-h-screen min-w-0 bg-[#f5f7f5]">
        <aside aria-hidden="true" className="fixed inset-y-0 left-0 hidden w-[76px] border-r border-[#e8ede9] bg-white p-5 md:block xl:w-[244px]">
          <Bar className="h-10 w-10 xl:w-full" /><div className="mt-10 space-y-5">{Array.from({ length: 6 }, (_, index) => <Bar className="h-8 w-full" key={index} />)}</div>
        </aside>
        <div className="md:pl-[76px] xl:pl-[244px]">
          <header aria-hidden="true" className="flex h-16 items-center justify-between border-b border-[#e8ede9] bg-white px-4 sm:h-[76px] sm:px-8">
            <Bar className="h-4 w-40" /><Bar className="h-9 w-32" />
          </header>
          <main className="mx-auto w-full max-w-[1500px] space-y-6 px-4 py-6 sm:px-8 sm:py-8 lg:px-10" role="status">
            <span className="sr-only">Loading workspace</span>
            <Heading action /><Metrics />
            <div className="grid gap-5 xl:grid-cols-2"><Panel className="p-5"><Bar className="h-5 w-40" /><Bar className="mt-6 h-48 w-full" /></Panel><Panel className="p-5"><Bar className="h-5 w-40" /><div className="mt-6 space-y-4">{Array.from({ length: 3 }, (_, index) => <Bar className="h-10 w-full" key={index} />)}</div></Panel></div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div aria-busy="true" className="space-y-6" role="status">
      <span className="sr-only">Loading {variant} page</span>
      <PageContent variant={variant} />
    </div>
  );
}
