-- Datamart: what BI reads. Net total per day, so a dashboard needs no join.
select
    fact_sale.sale_date,
    count(*) as orders,
    sum(fact_sale.gross_amount) as gross_total,
    sum(fact_sale.tax_amount) as tax_total,
    sum(fact_sale.net_amount) as net_total
from {{ ref('fact_sale') }}
group by fact_sale.sale_date
order by fact_sale.sale_date
