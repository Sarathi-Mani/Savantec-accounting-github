import { OverviewCardsGroup } from "./_components/overview-cards";
import { RecentInvoicesCard } from "./_components/recent-invoices";
import { OutstandingInvoicesCard } from "./_components/outstanding-invoices";
import { QuickActionsCard } from "./_components/quick-actions";
import { GstSummaryCard } from "./_components/gst-summary";

export default function Home() {
  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-dark dark:text-white">Dashboard</h1>
        <p className="text-sm text-dark-6">Welcome to GST Invoice Pro</p>
      </div>

        <OverviewCardsGroup />

      <div className="mt-6 grid grid-cols-12 gap-4 md:gap-6 2xl:gap-7.5">
        <div className="col-span-12 xl:col-span-8">
          <RecentInvoicesCard />
        </div>

        <div className="col-span-12 xl:col-span-4">
          <QuickActionsCard />
        </div>

        <div className="col-span-12 xl:col-span-7">
          <OutstandingInvoicesCard />
        </div>

        <div className="col-span-12 xl:col-span-5">
          <GstSummaryCard />
        </div>
      </div>
    </>
  );
}
