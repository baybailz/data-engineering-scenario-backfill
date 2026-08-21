-- Conformed: the sale fact, incremental on delete+insert by sale_date. A
-- run only ever touches the range in [backfill_start, backfill_end] -
-- one day for a normal load, a wider span for a backfill, everything for
-- a --full-refresh. Rows outside that range are never read or rewritten,
-- which is what makes a backfill bounded and a repeat of it a no-op.
{{ config(
    unique_key='sale_id',
    incremental_strategy='delete+insert'
) }}

with trn_sale as (
    select * from {{ ref('trn_tbl_sale') }}
),

dim_store as (
    select
        store_key,
        store_id
    from {{ ref('dim_store') }}
),

joined as (
    select
        trn_sale.sale_id,
        dim_store.store_key,
        trn_sale.sale_date,
        trn_sale.channel,
        trn_sale.gross_amount,
        trn_sale.tax_amount,
        trn_sale.net_amount
    from trn_sale
    inner join dim_store on trn_sale.store_id = dim_store.store_id
)

select
    {{ surrogate_key(['joined.sale_id']) }} as sale_key,
    joined.sale_id,
    joined.store_key,
    joined.sale_date,
    joined.channel,
    joined.gross_amount,
    joined.tax_amount,
    joined.net_amount,
    current_timestamp as loaded_at,
    current_timestamp as dbt_run_timestamp
from joined
{% if is_incremental() %}
    where
        joined.sale_date between
        cast('{{ var("backfill_start", "1900-01-01") }}' as date)
        and cast('{{ var("backfill_end", "1900-01-01") }}' as date)
{% endif %}
