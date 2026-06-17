with open('src/components/DataTablePanel.tsx', 'r') as f:
    content = f.read()

old_date = """      case "date":
        formattedValue = new Date(value).toLocaleDateString();
        break;"""

new_date = """      case "date":
        formattedValue = new Date(value).toLocaleDateString("en-AU");
        break;"""

content = content.replace(old_date, new_date)

with open('src/components/DataTablePanel.tsx', 'w') as f:
    f.write(content)
