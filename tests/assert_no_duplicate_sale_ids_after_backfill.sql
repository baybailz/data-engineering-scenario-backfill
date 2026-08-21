-- delete+insert on sale_date must never leave two rows for the same
-- sale_id. Running the same backfill twice should change nothing.
select
    fact_sale.sale_id,
    count(*) as n
from {{ ref('fact_sale') }}
group by fact_sale.sale_id
having count(*) > 1
