-- Net amount can never exceed gross amount: tax_amount is never negative,
-- so gross - tax <= gross always. If this returns rows, the sign is
-- flipped somewhere in trn_tbl_sale.
select
    fact_sale.sale_id,
    fact_sale.gross_amount,
    fact_sale.net_amount
from {{ ref('fact_sale') }}
where fact_sale.net_amount > fact_sale.gross_amount
