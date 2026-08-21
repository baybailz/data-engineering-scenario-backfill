-- Stage over the landing table. sale_id is the natural key; sale_date is
-- the partition key every downstream layer replays on.
with source as (
    select * from {{ ref('incoming_sale') }}
)

select
    sale_id,
    store_id,
    cast(sale_date as date) as sale_date,
    cast(gross_amount as decimal(10, 2)) as gross_amount,
    cast(tax_amount as decimal(10, 2)) as tax_amount,
    channel,
    source_file
from source
