/* Console tabs for this scenario.
   tabs:    [{key, label, count()}]  in display order
   render:  {key: () => html}        S.tablePanel / S.incomingPanel are generic
   afterRun(action) -> tab key to show when a run finishes (optional)
   toast(action, before, after) -> message after a run (optional) */
'use strict';
const statusBadge = v => S.badge(v, v==='new'?'b-new':'b-dup', v==='new'?S.ICO.check:S.ICO.copy);

window.PANELS = {
  tabs: [
    {key:'incoming', label:'incoming/*.csv', count:()=>S.D.next?.name?S.D.next.rows.length:0},
    {key:'dim_customer', label:'dim_customer', count:()=>(S.D.tables.dim_customer||[]).length},
    {key:'dim_record_status', label:'dim_record_status', count:()=>(S.D.tables.dim_record_status||[]).length},
    {key:'dm_customer_summary', label:'dm_customer_summary', count:()=>(S.D.tables.dm_customer_summary||[]).length},
  ],
  render: {
    incoming: () => S.incomingPanel(),
    dim_customer: () => S.tablePanel('dim_customer', 'the customer dimension after every load so far',
      {rowClass: r => r.source!=='crm_customer' ? 'rowimp' : ''}),
    dim_record_status: () => S.tablePanel('dim_record_status', 'one verdict per incoming record',
      {cell: (c,v) => c==='status' ? statusBadge(v) : S.esc(S.fmtCell(v))}),
    dm_customer_summary: () => S.tablePanel('dm_customer_summary', 'what BI reads'),
  },
  afterRun: action => action===S.CFG.actions.reset ? 'incoming' : 'dim_customer',
  toast: (action, before, after) => {
    if (action===S.CFG.actions.reset) return 'Demo reset ↺';
    const parts=[], add=(n,w)=>{ if(n>0) parts.push(`<b>${n}</b> ${w}`); };
    add((after.customers_total??0)-(before.customers_total??0), 'new customers imported');
    add((after.duplicates_blocked??0)-(before.duplicates_blocked??0), 'duplicates blocked');
    return parts.length ? parts.join(' · ') : 'Load complete';
  },
};
