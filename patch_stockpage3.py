with open('src/pages/StockPage.tsx', 'r') as f:
    content = f.read()

old_date = "<TableCell>{o.order_date}</TableCell>"
new_date = "<TableCell>{new Date(o.order_date).toLocaleDateString(\"en-AU\")}</TableCell>"

content = content.replace(old_date, new_date)

with open('src/pages/StockPage.tsx', 'w') as f:
    f.write(content)
