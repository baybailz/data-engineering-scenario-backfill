/* Console tabs for the backfill scenario. */
'use strict';
const actionBadge = a => S.badge(a, a==='fix_and_backfill'?'b-new':(a==='inject_bug'?'b-dup':'b-crm'));

window.PANELS = {
  tabs: [
    {key:'incoming', label:'incoming/*.csv', count:()=>S.D.next?.name?S.D.next.rows.length:0},
    {key:'dim_partition_status', label:'dim_partition_status', count:()=>(S.D.tables.dim_partition_status||[]).length},
    {key:'fact_sale', label:'fact_sale', count:()=>(S.D.tables.fact_sale||[]).length},
    {key:'dm_daily_sales', label:'dm_daily_sales', count:()=>(S.D.tables.dm_daily_sales||[]).length},
  ],
  render: {
    incoming: () => S.incomingPanel(),
    dim_partition_status: () => S.tablePanel('dim_partition_status', 'one watermark row per sale_date',
      {rowClass: r => r.bugged ? 'rowdup' : '', cell: (c,v,r) => c==='built_by_action' ? actionBadge(v) : S.esc(S.fmtCell(v))}),
    fact_sale: () => S.tablePanel('fact_sale', 'one row per sale, net_amount as last built'),
    dm_daily_sales: () => S.tablePanel('dm_daily_sales', 'net total per day, what BI reads',
      {rowClass: r => r.net_total > r.gross_total ? 'rowdup' : '',
       cell: (c,v,r) => c==='net_total'
         ? `${S.meter(r.gross_total ? Math.min(1, v/r.gross_total) : 0)}${r.net_total > r.gross_total ? ' <span title="net exceeds gross: tax_bug was live for this day">▲</span>' : ''}`
         : S.esc(S.fmtCell(v))}),
  },
  afterRun: action => action===S.CFG.actions.reset ? 'incoming' : 'dim_partition_status',
  toast: (action, before, after) => {
    if (action===S.CFG.actions.reset) return 'Demo reset ↺';
    if (action==='inject_bug') return 'tax_bug flag set ⚠';
    if (action==='fix_and_backfill') return `Backfill done · <b>${after.partitions_bugged??0}</b> partitions still bugged`;
    const delta = (after.net_total??0)-(before.net_total??0);
    return `Load complete · net total ${delta>=0?'+':''}${delta.toFixed(2)}`;
  },
};
