with open('src/pages/StockPage.tsx', 'r') as f:
    content = f.read()

old_forecast_cols = """              columns={[
                { key: "base_sku", label: "Base SKU", type: "string" },
                { key: "category", label: "Category", type: "string" },
                { key: "min_days_of_cover", label: "Min Days of Cover", type: "number" },
                { key: "any_reorder", label: "Needs Reorder (Any)", type: "boolean" },
              ]}"""

new_forecast_cols = """              columns={[
                { key: "base_sku", label: "Base SKU", type: "string" },
                { key: "product_name", label: "Product Name", type: "string" },
                { key: "category", label: "Category", type: "string" },
                { key: "min_days_of_cover", label: "Min Days of Cover", type: "number" },
                { key: "any_reorder", label: "Needs Reorder (Any)", type: "boolean" },
              ]}"""

content = content.replace(old_forecast_cols, new_forecast_cols)

old_variant_head = """                  <TableHead>
                    <TableRow>
                      <TableCell>Variant SKU</TableCell>
                      <TableCell align="right">Current Stock</TableCell>"""

new_variant_head = """                  <TableHead>
                    <TableRow>
                      <TableCell>Variant SKU</TableCell>
                      <TableCell>Product Name</TableCell>
                      <TableCell align="right">Current Stock</TableCell>"""

content = content.replace(old_variant_head, new_variant_head)

old_variant_row = """                        <TableCell>
                          <a href={\https://naturalyield.com.au/wp-admin/post.php?post=\&action=edit\} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
                            {v.sku}
                          </a>
                        </TableCell>
                        <TableCell align="right">{v.current_stock_qty}</TableCell>"""

new_variant_row = """                        <TableCell>
                          <a href={\https://naturalyield.com.au/wp-admin/post.php?post=\&action=edit\} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
                            {v.sku}
                          </a>
                        </TableCell>
                        <TableCell>{v.product_name}</TableCell>
                        <TableCell align="right">{v.current_stock_qty}</TableCell>"""

content = content.replace(old_variant_row, new_variant_row)

with open('src/pages/StockPage.tsx', 'w') as f:
    f.write(content)
