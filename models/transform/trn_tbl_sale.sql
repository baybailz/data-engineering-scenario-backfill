-- Transform: the business logic. net_amount should always be
-- gross_amount minus tax_amount. The tax_bug var flips the sign; a
-- pipeline run with the bug flag on ships a wrong number, on purpose,
-- so the demo has something to catch and fix.
{{ config(unique_key='sale_id') }}

with stage as (
    select * from {{ ref('stg_sale') }}
)

select
    stage.sale_id,
    stage.store_id,
    stage.sale_date,
    stage.channel,
    stage.gross_amount,
    stage.tax_amount,
    case
        when {{ var('tax_bug', false) }} then stage.gross_amount + stage.tax_amount
        else stage.gross_amount - stage.tax_amount
    end as net_amount
from stage
