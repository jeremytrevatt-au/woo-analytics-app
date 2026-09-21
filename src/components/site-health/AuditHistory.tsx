import {
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { WebAuditRecord } from "../../api/siteHealthApi";

interface Props {
  records: WebAuditRecord[];
}

export default function AuditHistory({ records }: Props) {
  return (
    <Card>
      <CardContent>
        <Typography variant="h5" sx={{ mb: 2 }}>Recent web audits</Typography>
        {records.length ? (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Requested / completed</TableCell>
                  <TableCell>Audit ID</TableCell>
                  <TableCell>Request ID</TableCell>
                  <TableCell>URL</TableCell>
                  <TableCell>Strategy</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>PSI</TableCell>
                  <TableCell>CrUX</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.audit_id}>
                    <TableCell>
                      {new Date(record.requested_at).toLocaleString()}
                      <br />
                      {record.completed_at ? new Date(record.completed_at).toLocaleString() : "Not completed"}
                    </TableCell>
                    <TableCell sx={{ fontFamily: "monospace" }}>{record.audit_id}</TableCell>
                    <TableCell sx={{ fontFamily: "monospace" }}>{record.request_id}</TableCell>
                    <TableCell sx={{ maxWidth: 320, overflowWrap: "anywhere" }}>{record.url}</TableCell>
                    <TableCell>{record.strategy}</TableCell>
                    <TableCell>{record.status}</TableCell>
                    <TableCell>{record.collectors.psi.status}</TableCell>
                    <TableCell>{record.collectors.crux.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <Typography color="text.secondary">No web audit history is available.</Typography>
        )}
      </CardContent>
    </Card>
  );
}
