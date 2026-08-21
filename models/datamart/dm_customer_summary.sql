-- Datamart: what BI reads. Joins are done here so the report needs none.
select
    dim_customer.segment,
    dim_customer.state,
    count(*) as customers,
    sum(case when dim_customer.source <> 'crm_customer' then 1 else 0 end) as imported_customers
from {{ ref('dim_customer') }}
group by dim_customer.segment, dim_customer.state
order by dim_customer.segment, dim_customer.state
