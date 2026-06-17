with open('src/pages/StockPage.tsx', 'r') as f:
    content = f.read()

old_panel = """          <DataTablePanel
            title=""
            rows={stockForecast.records as any}
              columns={[
                { key: "sku", label: "SKU", type: "string" },
                { key: "currentStockQty", label: "Current Stock", type: "number" },
                { key: "avgDailyUsage", label: "Avg Daily Usage", type: "number" },
                { key: "daysOfCover", label: "Days of Cover", type: "number" },
                { key: "projectedStockoutDate", label: "Projected Stockout", type: "date" },
                { key: "reorderWithinLeadTime", label: "Needs Reorder", type: "boolean" },
              ]}
            page={stockForecast.page}
            pageSize={stockForecast.pageSize}
            totalCount={stockForecast.totalCount}
            onPageChange={setForecastPage}
            getLinkUrl={(row, col) => col.key === "sku" ? \https://naturalyield.com.au/wp-admin/post.php?post=\&action=edit\ : null}
          />"""

new_panel = """          <DataTablePanel
            title=""
            rows={stockForecast.records as any}
              columns={[
                { key: "base_sku", label: "Base SKU", type: "string" },
                { key: "product_name", label: "Product Name", type: "string" },
                { key: "category", label: "Category", type: "string" },
                { key: "min_days_of_cover", label: "Min Days of Cover", type: "number" },
                { key: "any_reorder", label: "Needs Reorder (Any)", type: "boolean" },
              ]}
            page={stockForecast.page}
            pageSize={stockForecast.pageSize}
            totalCount={stockForecast.totalCount}
            onPageChange={setForecastPage}
            renderExpandedRow={(row) => {
              const variants = row.variants as any[];
              if (!variants || variants.length === 0) return null;
              return (
                <Table size="small" aria-label="variants">
                  <TableHead>
                    <TableRow>
                      <TableCell>Variant SKU</TableCell>
                      <TableCell>Product Name</TableCell>
                      <TableCell align="right">Current Stock</TableCell>
                      <TableCell align="right">Avg Daily Usage</TableCell>
                      <TableCell align="right">Days of Cover</TableCell>
                      <TableCell>Projected Stockout</TableCell>
                      <TableCell>Needs Reorder</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {variants.map((v: any, idx: number) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <a href={\https://naturalyield.com.au/wp-admin/post.php?post=\&action=edit\} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline' }}>
                            {v.sku}
                          </a>
                        </TableCell>
                        <TableCell>{v.product_name}</TableCell>
                        <TableCell align="right">{v.current_stock_qty}</TableCell>
                        <TableCell align="right">{v.avg_daily_usage?.toFixed(2)}</TableCell>
                        <TableCell align="right">{v.days_of_cover?.toFixed(1)}</TableCell>
                        <TableCell>{v.projected_stockout_date ? new Date(v.projected_stockout_date).toLocaleDateString("en-AU") : "-"}</TableCell>
                        <TableCell>{v.reorder_within_lead_time ? "Yes" : "No"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              );
            }}
          />"""

content = content.replace(old_panel, new_panel)

with open('src/pages/StockPage.tsx', 'w') as f:
    f.write(content)
