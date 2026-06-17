with open('src/api/analyticsApi.ts', 'r') as f:
    content = f.read()

import re
content = re.sub(r"const response = await fetchJson<PaginatedResponse<any>>\(\/api/v1/stock/shortages\?\\\\\);", "const response = await fetchJson<PaginatedResponse<any>>(/api/v1/stock/shortages?\);", content)

with open('src/api/analyticsApi.ts', 'w') as f:
    f.write(content)
