import { Fragment, useEffect, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Divider,
  Dialog,
  FormControl,
  InputLabel,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import {
  acceptShippitReturnQuote,
  cancelReturn,
  confirmShippitReturnOrder,
  createReturn,
  fetchReturnDocument,
  fetchShippitReturnLabel,
  getShipmentMode,
  getShippitReturnOrder,
  getReturnableOrderItems,
  listReturns,
  previewReturnCancellation,
  previewReturnParcels,
  previewShippitReturnQuote,
  printShippitReturnLabel,
  probeShippitReturnsEndpoints,
  sendReturnDocumentEmail,
  ReturnableOrderResponse,
  ReturnCase,
  ReturnCancellationPreview,
  ReturnParcel,
  ReturnSender,
  ReturnStatus,
  ReturnWorkflowStage,
  ShippitReturnOrderResponse,
  ShippitReturnsProbeResult,
  ShippitReturnsProbeResponse,
  updateReturn,
} from "../api/returnsApi";
import { ApiRequestError } from "../api/httpClient";
import CrmNoteComposer from "../components/CrmNoteComposer";
import { wordpressAdminUrl } from "../config/wordpress";

const RETURN_STATUS_OPTIONS: Array<{ value: ReturnStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "requested", label: "Requested" },
  { value: "approved", label: "Approved" },
  { value: "in_transit", label: "In Transit" },
  { value: "received", label: "Received" },
  { value: "closed", label: "Closed" },
  { value: "cancelled", label: "Cancelled" },
];

type QuoteRow = {
  courierType: string;
  serviceLevel: string;
  price: number;
  estimatedTransitTime: string;
};

const emptyReturnSender: ReturnSender = {
  name: "",
  company_name: "",
  address_line_1: "",
  address_line_2: "",
  suburb: "",
  state: "",
  postcode: "",
  country_code: "AU",
  phone: "",
  email: "",
  instructions: "",
};

function senderFromShipping(response: ReturnableOrderResponse): ReturnSender {
  const shipping = response.order.shipping_address;
  return {
    name: `${shipping.first_name || ""} ${shipping.last_name || ""}`.trim(),
    company_name: shipping.company || "",
    address_line_1: shipping.address_1 || "",
    address_line_2: shipping.address_2 || "",
    suburb: shipping.suburb || "",
    state: shipping.state || "",
    postcode: shipping.postcode || "",
    country_code: shipping.country || "AU",
    phone: shipping.phone || "",
    email: response.order.customer.email || "",
    instructions: "",
  };
}

function hasReturnSenderAddress(sender: ReturnSender | null | undefined): sender is ReturnSender {
  if (!sender || Array.isArray(sender)) {
    return false;
  }
  return Boolean(
    (sender.address_line_1 || "").trim()
    || (sender.suburb || "").trim()
    || (sender.state || "").trim()
    || (sender.postcode || "").trim()
  );
}

function senderAddressKey(sender: ReturnSender): string {
  return [sender.name, sender.address_line_1, sender.address_line_2, sender.suburb, sender.state, sender.postcode, sender.country_code]
    .map(value => (value || "").trim().toLowerCase())
    .join("|");
}

function savedSenderIsDifferent(saved: ReturnSender | null | undefined, original: ReturnSender): boolean {
  if (!hasReturnSenderAddress(saved)) {
    return false;
  }
  return senderAddressKey({ ...emptyReturnSender, ...saved }) !== senderAddressKey(original);
}

const SINGLE_EMAIL_ADDRESS = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

function isSingleEmailAddress(value: string): boolean {
  return value.length <= 254 && SINGLE_EMAIL_ADDRESS.test(value);
}

function customerReturnEmailRecipient(
  senderEmail: string | null | undefined,
  billingEmail: string | null | undefined,
): string {
  const sender = (senderEmail || "").trim();
  if (sender) {
    return sender;
  }
  return (billingEmail || "").trim();
}

function liveTrackingNumber(returnCase: ReturnCase): string {
  const tracking = (returnCase.shippit_tracking_number || returnCase.return_shipment?.tracking_number || "").trim();
  if (!tracking) {
    return "";
  }
  const state = (returnCase.shippit_state || returnCase.return_shipment?.state || "").trim().toLowerCase();
  if (state === "cancelled" || returnCase.status === "cancelled") {
    return "";
  }
  return tracking;
}

function shipmentAlreadyStarted(returnCase: ReturnCase | null, shippitReturn: ShippitReturnOrderResponse | null): boolean {
  const responseTracking = (shippitReturn?.return.tracking_number || shippitReturn?.return.return_order_id || "").trim();
  if (responseTracking) {
    return true;
  }
  return Boolean(returnCase && liveTrackingNumber(returnCase));
}

function requestedCaseIsOpenForEditing(returnCase: ReturnCase | null, shippitReturn: ShippitReturnOrderResponse | null): boolean {
  return Boolean(returnCase && returnCase.status === "requested" && !shipmentAlreadyStarted(returnCase, shippitReturn));
}

function returnCaseCanBeEdited(returnCase: ReturnCase): boolean {
  return returnCase.status === "requested" && !liveTrackingNumber(returnCase);
}

const LABEL_ALREADY_REQUESTED_STATES = new Set([
  "despatch_in_progress",
  "ready_for_pickup",
  "booked_for_delivery",
  "in_transit",
  "with_driver",
  "transit",
  "completed",
  "delivered",
]);

const LABEL_ALREADY_REQUESTED_CREATE_STATES = new Set([
  "label_printed",
  "label_requested",
  "confirmed",
  "booked",
]);

function returnLabelUrl(returnCase: ReturnCase): string {
  return (returnCase.shippit_label_url || returnCase.return_shipment?.label_url || "").trim();
}

function returnOrderIdForLabel(returnCase: ReturnCase): string {
  return (
    returnCase.shippit_return_order_id
    || returnCase.return_shipment?.return_order_id
    || returnCase.shippit_tracking_number
    || returnCase.return_shipment?.tracking_number
    || ""
  ).trim();
}

function returnLabelNotRequested(returnCase: ReturnCase): boolean {
  if (returnLabelUrl(returnCase)) {
    return false;
  }
  const state = (returnCase.shippit_state || returnCase.return_shipment?.state || "").trim().toLowerCase();
  if (LABEL_ALREADY_REQUESTED_STATES.has(state)) {
    return false;
  }
  const createState = (returnCase.shippit_create_state || "").trim().toLowerCase();
  return !LABEL_ALREADY_REQUESTED_CREATE_STATES.has(createState);
}

function mergeShipmentResponse(returnCase: ReturnCase, response: ShippitReturnOrderResponse): ReturnCase {
  const nextLabel = (response.return.label_url || "").trim();
  const labelUrl = nextLabel || returnLabelUrl(returnCase);
  const state = (response.shippit_state || response.return.state || returnCase.shippit_state || "").trim();
  const tracking = (response.return.tracking_number || returnCase.shippit_tracking_number || "").trim();
  const currentCreateState = (returnCase.shippit_create_state || "").trim().toLowerCase();
  const createState = response.label_ready
    ? (LABEL_ALREADY_REQUESTED_CREATE_STATES.has(currentCreateState) ? returnCase.shippit_create_state : "label_requested")
    : returnCase.shippit_create_state;
  return {
    ...returnCase,
    shippit_state: state || returnCase.shippit_state,
    shippit_tracking_number: tracking || returnCase.shippit_tracking_number,
    shippit_label_url: labelUrl,
    shippit_return_order_id: response.return.return_order_id || returnCase.shippit_return_order_id,
    shippit_create_state: createState,
    return_shipment: {
      ...returnCase.return_shipment,
      return_order_id: response.return.return_order_id || returnCase.return_shipment?.return_order_id,
      tracking_number: tracking || returnCase.return_shipment?.tracking_number,
      state: state || returnCase.return_shipment?.state,
      label_url: labelUrl,
    },
  };
}

function qtyOnOpenCase(returnCase: ReturnCase | null, orderItemId: number): number {
  const line = returnCase?.lines.find(item => item.order_item_id === orderItemId);
  const qty = Number(line?.qty ?? 0);
  return Number.isFinite(qty) && qty > 0 ? qty : 0;
}

function ReturnsPage() {
  const [returns, setReturns] = useState<ReturnCase[]>([]);
  const [statusFilter, setStatusFilter] = useState<ReturnStatus | "all">("all");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [orderId, setOrderId] = useState("");
  const [reason, setReason] = useState("");
  const [resolution, setResolution] = useState("");
  const [refundExpected, setRefundExpected] = useState(false);
  const [notes, setNotes] = useState("");
  const [returnableOrder, setReturnableOrder] = useState<ReturnableOrderResponse | null>(null);
  const [activeReturnCase, setActiveReturnCase] = useState<ReturnCase | null>(null);
  const [returnLineQty, setReturnLineQty] = useState<Record<number, string>>({});
  const [loadingReturnableItems, setLoadingReturnableItems] = useState(false);
  const [probeTrackingNumber, setProbeTrackingNumber] = useState("");
  const [probeResult, setProbeResult] = useState<ShippitReturnsProbeResponse | null>(null);
  const [probingShippit, setProbingShippit] = useState(false);
  const [quotePreview, setQuotePreview] = useState<ShippitReturnsProbeResult | null>(null);
  const [previewingQuote, setPreviewingQuote] = useState(false);
  const [shippitReturn, setShippitReturn] = useState<ShippitReturnOrderResponse | null>(null);
  const [workflowStage, setWorkflowStage] = useState<ReturnWorkflowStage>("not_quoted");
  const [shippitState, setShippitState] = useState("");
  const [labelReady, setLabelReady] = useState(false);
  const [acceptingQuote, setAcceptingQuote] = useState(false);
  const [confirmingOrder, setConfirmingOrder] = useState(false);
  const [pollingShippitReturn, setPollingShippitReturn] = useState(false);
  const [fetchingLabel, setFetchingLabel] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<QuoteRow | null>(null);
  const [returnParcels, setReturnParcels] = useState<ReturnParcel[]>([]);
  const [recommendedReturnParcels, setRecommendedReturnParcels] = useState<ReturnParcel[]>([]);
  const [parcelSource, setParcelSource] = useState<"ny_recommendation" | "manual">("ny_recommendation");
  const [loadingParcelPreview, setLoadingParcelPreview] = useState(false);
  const [useReturnSenderOverride, setUseReturnSenderOverride] = useState(false);
  const [originalReturnSender, setOriginalReturnSender] = useState<ReturnSender>(emptyReturnSender);
  const [returnSender, setReturnSender] = useState<ReturnSender>(emptyReturnSender);
  const [expandedReturnId, setExpandedReturnId] = useState<number | null>(null);
  const [cancelPreview, setCancelPreview] = useState<ReturnCancellationPreview | null>(null);
  const [returnPendingCancellation, setReturnPendingCancellation] = useState<ReturnCase | null>(null);
  const [previewingCancellation, setPreviewingCancellation] = useState(false);
  const [cancellingReturn, setCancellingReturn] = useState(false);
  const [cancelOperationId, setCancelOperationId] = useState<string | null>(null);
  const returnFormRef = useRef<HTMLDivElement | null>(null);
  const editingOpenRequestedCase = requestedCaseIsOpenForEditing(activeReturnCase, shippitReturn);
  const caseFieldsLocked = Boolean(activeReturnCase) && !editingOpenRequestedCase;

  const replaceReturnCase = (updated: ReturnCase) => {
    setReturns(previous => previous.map(item => item.id === updated.id ? updated : item));
    setActiveReturnCase(current => current && current.id === updated.id ? updated : current);
  };

  const loadReturns = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await listReturns({ status: statusFilter });
      setReturns(response);
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to load return cases." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReturns();
  }, [statusFilter]);

  useEffect(() => {
    if (!activeReturnCase) {
      return;
    }
    let cancelled = false;
    getShipmentMode(activeReturnCase.id, activeReturnCase.order_id)
      .then(response => {
        if (cancelled) {
          return;
        }
        setLabelReady(response.label_ready);
        setShippitState((response.shippit_state || "").trim());
        if (response.workflow_stage) {
          setWorkflowStage(response.workflow_stage);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [activeReturnCase?.id, activeReturnCase?.order_id]);

  const invalidateOpenQuote = () => {
    setQuotePreview(null);
    setSelectedQuote(null);
    setWorkflowStage(current => current === "quoted" ? "not_quoted" : current);
  };

  const refreshParcelRecommendation = async (returnId: number, numericOrderId: number) => {
    setLoadingParcelPreview(true);
    try {
      const preview = await previewReturnParcels({ orderId: numericOrderId, returnId });
      setRecommendedReturnParcels(preview.parcels);
      setReturnParcels(preview.parcels);
      setParcelSource("ny_recommendation");
      return preview.parcels.length;
    } catch (error) {
      setRecommendedReturnParcels([]);
      setReturnParcels([]);
      throw error;
    } finally {
      setLoadingParcelPreview(false);
    }
  };

  const handleCreate = async () => {
    const numericOrderId = Number(orderId);
    if (!Number.isInteger(numericOrderId) || numericOrderId <= 0) {
      setMessage({ type: "error", text: "Enter a valid WooCommerce order ID." });
      return;
    }
    if (caseFieldsLocked) {
      setMessage({ type: "error", text: "This return already has a Shippit shipment, so it cannot be edited or created again." });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      const selectedLines = returnableOrder?.items
        .map(item => ({
          order_item_id: item.order_item_id,
          product_id: item.product_id,
          variation_id: item.variation_id,
          sku: item.sku,
          product_name: item.product_name,
          qty: Number(returnLineQty[item.order_item_id] || 0),
        }))
        .filter(line => Number.isFinite(line.qty) && line.qty > 0) ?? [];
      if (selectedLines.length === 0) {
        setMessage({ type: "error", text: "Enter at least one return quantity before saving the return case." });
        return;
      }
      const senderForShipment = useReturnSenderOverride ? returnSender : originalReturnSender;
      const missing = [
        ["name", senderForShipment.name],
        ["address", senderForShipment.address_line_1],
        ["suburb", senderForShipment.suburb],
        ["state", senderForShipment.state],
        ["postcode", senderForShipment.postcode],
        ["country", senderForShipment.country_code],
        ["phone", senderForShipment.phone || ""],
        ["email", senderForShipment.email || ""],
      ].filter(([, value]) => !value.trim()).map(([label]) => label);
      if (missing.length > 0) {
        setMessage({ type: "error", text: `Complete the return sender fields: ${missing.join(", ")}.` });
        return;
      }

      const payload = {
        reason,
        resolution,
        refund_expected: refundExpected,
        notes,
        return_sender: senderForShipment,
        lines: selectedLines,
      };
      const saved = editingOpenRequestedCase && activeReturnCase
        ? await updateReturn(activeReturnCase.id, payload)
        : await createReturn({ order_id: numericOrderId, ...payload });
      setActiveReturnCase(saved);
      invalidateOpenQuote();
      let completionMessage: { type: "success" | "error"; text: string };
      try {
        const parcelCount = await refreshParcelRecommendation(saved.id, numericOrderId);
        completionMessage = {
          type: "success",
          text: `Return case #${saved.id} saved with ${parcelCount} NY Shipping recommended parcel${parcelCount === 1 ? "" : "s"}.`,
        };
      } catch (error: any) {
        completionMessage = { type: "error", text: `Return case #${saved.id} was saved, but its NY Shipping parcel recommendation failed: ${error.message || "unknown error"}` };
      }
      await loadReturns();
      setMessage(completionMessage);
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to save return case." });
    } finally {
      setSaving(false);
    }
  };

  const loadRequestedCaseForEditing = async (returnCase: ReturnCase) => {
    setOrderId(String(returnCase.order_id));
    setReason(returnCase.reason || "");
    setResolution(returnCase.resolution || "");
    setRefundExpected(Boolean(returnCase.refund_expected));
    setNotes(returnCase.notes || "");
    setActiveReturnCase(returnCase);
    setShippitReturn(null);
    setQuotePreview(null);
    setSelectedQuote(null);
    setWorkflowStage("not_quoted");
    setLabelReady(false);
    setReturnParcels([]);
    setRecommendedReturnParcels([]);
    setParcelSource("ny_recommendation");
    setLoadingReturnableItems(true);
    setMessage(null);
    try {
      const response = await getReturnableOrderItems(returnCase.order_id);
      setReturnableOrder(response);
      const initialQty: Record<number, string> = {};
      response.items.forEach(item => {
        const ownQty = qtyOnOpenCase(returnCase, item.order_item_id);
        initialQty[item.order_item_id] = ownQty > 0 ? String(ownQty) : "";
      });
      setReturnLineQty(initialQty);
      const shippingSender = senderFromShipping(response);
      setOriginalReturnSender(shippingSender);
      if (savedSenderIsDifferent(returnCase.return_sender, shippingSender)) {
        setUseReturnSenderOverride(true);
        setReturnSender({ ...emptyReturnSender, ...returnCase.return_sender });
      } else {
        setUseReturnSenderOverride(false);
        setReturnSender(shippingSender);
      }
      let parcelNote = "";
      try {
        const parcelCount = await refreshParcelRecommendation(returnCase.id, returnCase.order_id);
        parcelNote = ` ${parcelCount} recommended parcel${parcelCount === 1 ? "" : "s"} loaded.`;
      } catch (error: any) {
        parcelNote = ` Parcel recommendation failed: ${error.message || "unknown error"}.`;
      }
      setMessage({
        type: parcelNote.includes("failed") ? "error" : "success",
        text: `Return case #${returnCase.id} is Requested and can be edited, quoted, and booked.${parcelNote}`,
      });
      const form = returnFormRef.current;
      if (form && typeof form.scrollIntoView === "function") {
        form.scrollIntoView({ block: "start" });
      }
    } catch (error: any) {
      setReturnableOrder(null);
      setReturnLineQty({});
      setMessage({ type: "error", text: error.message || "Failed to open the requested return case." });
    } finally {
      setLoadingReturnableItems(false);
    }
  };

  const handleLoadReturnableItems = async () => {
    const numericOrderId = Number(orderId);
    if (!Number.isInteger(numericOrderId) || numericOrderId <= 0) {
      setMessage({ type: "error", text: "Enter a valid WooCommerce order ID first." });
      return;
    }
    setLoadingReturnableItems(true);
    setMessage(null);
    try {
      const response = await getReturnableOrderItems(numericOrderId);
      setReturnableOrder(response);
      const initialQty: Record<number, string> = {};
      response.items.forEach(item => {
        initialQty[item.order_item_id] = "";
      });
      setReturnLineQty(initialQty);
      const shippingSender = senderFromShipping(response);
      setOriginalReturnSender(shippingSender);
      setReturnSender(shippingSender);
      setUseReturnSenderOverride(false);
      setMessage({ type: "success", text: `Loaded ${response.items.length} returnable item rows for order #${response.order.number}.` });
    } catch (error: any) {
      setReturnableOrder(null);
      setReturnLineQty({});
      setMessage({ type: "error", text: error.message || "Failed to load returnable order items." });
    } finally {
      setLoadingReturnableItems(false);
    }
  };

  const handleProbeShippit = async () => {
    setProbingShippit(true);
    setMessage(null);
    try {
      const numericOrderId = Number(orderId);
      const response = await probeShippitReturnsEndpoints({
        orderId: Number.isInteger(numericOrderId) && numericOrderId > 0 ? numericOrderId : undefined,
        trackingNumber: probeTrackingNumber.trim() || undefined,
      });
      setProbeResult(response);
      setMessage({ type: "success", text: "Shippit returns endpoint probe completed." });
    } catch (error: any) {
      setProbeResult(null);
      setMessage({ type: "error", text: error.message || "Failed to probe Shippit returns endpoints." });
    } finally {
      setProbingShippit(false);
    }
  };

  const selectedReturnLines = () => {
    return returnableOrder?.items
      .map(item => ({
        order_item_id: item.order_item_id,
        qty: Math.floor(Number(returnLineQty[item.order_item_id] || 0)),
      }))
      .filter(line => Number.isInteger(line.qty) && line.qty > 0) ?? [];
  };

  const handleSelectAllReturnableQty = () => {
    if (!returnableOrder) {
      return;
    }

    const allQty: Record<number, string> = {};
    returnableOrder.items.forEach(item => {
      const ownQty = editingOpenRequestedCase ? qtyOnOpenCase(activeReturnCase, item.order_item_id) : 0;
      allQty[item.order_item_id] = String(Math.floor(item.returnable_qty + ownQty));
    });
    setReturnLineQty(allQty);
    invalidateOpenQuote();
  };

  const handleClearReturnQty = () => {
    if (!returnableOrder) {
      return;
    }

    const emptyQty: Record<number, string> = {};
    returnableOrder.items.forEach(item => {
      emptyQty[item.order_item_id] = "";
    });
    setReturnLineQty(emptyQty);
    invalidateOpenQuote();
  };

  const updateReturnSender = (field: keyof ReturnSender, value: string) => {
    setReturnSender(current => ({ ...current, [field]: value }));
    invalidateOpenQuote();
  };

  const updateReturnParcel = (index: number, field: keyof ReturnParcel, value: string) => {
    const numericValue = Number(value);
    setReturnParcels(current => current.map((parcel, parcelIndex) => (
      parcelIndex === index ? { ...parcel, [field]: Number.isFinite(numericValue) ? numericValue : 0 } : parcel
    )));
    setParcelSource("manual");
    setQuotePreview(null);
    setSelectedQuote(null);
    setWorkflowStage(current => current === "quoted" ? "not_quoted" : current);
  };

  const addReturnParcel = () => {
    setReturnParcels(current => [...current, { qty: 1, weight_kg: 0, length_cm: 0, width_cm: 0, height_cm: 0 }]);
    setParcelSource("manual");
    setQuotePreview(null);
    setSelectedQuote(null);
    setWorkflowStage(current => current === "quoted" ? "not_quoted" : current);
  };

  const removeReturnParcel = (index: number) => {
    setReturnParcels(current => current.filter((_, parcelIndex) => parcelIndex !== index));
    setParcelSource("manual");
    setQuotePreview(null);
    setSelectedQuote(null);
    setWorkflowStage(current => current === "quoted" ? "not_quoted" : current);
  };

  const resetReturnParcels = () => {
    setReturnParcels(recommendedReturnParcels.map(parcel => ({ ...parcel })));
    setParcelSource("ny_recommendation");
    setQuotePreview(null);
    setSelectedQuote(null);
    setWorkflowStage(current => current === "quoted" ? "not_quoted" : current);
  };

  const applyShipmentResponse = (response: ShippitReturnOrderResponse) => {
    setShippitReturn(response);
    if (response.workflow_stage) {
      setWorkflowStage(response.workflow_stage);
    }
    if (typeof response.label_ready === "boolean") {
      setLabelReady(response.label_ready);
    }
    const nextState = (response.shippit_state || response.return.state || "").trim();
    if (nextState) {
      setShippitState(nextState);
    }
  };

  const handleAcceptQuote = async () => {
    const numericOrderId = Number(orderId);
    if (!Number.isInteger(numericOrderId) || numericOrderId <= 0) {
      setMessage({ type: "error", text: "Enter a valid WooCommerce order ID first." });
      return;
    }
    if (!activeReturnCase) {
      setMessage({ type: "error", text: "Save the return case before accepting a quote." });
      return;
    }
    if (!selectedQuote || workflowStage === "not_quoted") {
      setMessage({ type: "error", text: "Get a quote and select a price before accepting it." });
      return;
    }

    setAcceptingQuote(true);
    setMessage(null);
    try {
      const response = await acceptShippitReturnQuote({
        orderId: numericOrderId,
        returnId: activeReturnCase.id,
        operationId: crypto.randomUUID(),
        courierType: selectedQuote.courierType,
        quotedCost: selectedQuote.price,
        currency: returnableOrder!.order.currency,
        mode: "returns_api",
      });
      applyShipmentResponse(response);
      setMessage({
        type: "success",
        text: `Quote accepted. Shippit order ${response.return.return_order_id || response.return.tracking_number || ""} is in New Orders.`,
      });
    } catch (error: any) {
      setMessage({ type: "error", text: shippitErrorMessage(error, "Failed to accept the Shippit quote.") });
    } finally {
      setAcceptingQuote(false);
    }
  };

  const handleConfirmOrder = async () => {
    const numericOrderId = Number(orderId);
    if (!activeReturnCase || !Number.isInteger(numericOrderId) || numericOrderId <= 0) {
      setMessage({ type: "error", text: "Accept a quote before confirming the Shippit order." });
      return;
    }
    setConfirmingOrder(true);
    setMessage(null);
    try {
      const response = await confirmShippitReturnOrder({
        orderId: numericOrderId,
        returnId: activeReturnCase.id,
        mode: "returns_api",
      });
      applyShipmentResponse(response);
      const stateText = response.shippit_state || response.return.state || "unknown";
      setMessage({
        type: "success",
        text: `Label requested. This allocates the courier. Shippit state: ${stateText}.`,
      });
    } catch (error: any) {
      setMessage({ type: "error", text: shippitErrorMessage(error, "Failed to confirm the Shippit order.") });
    } finally {
      setConfirmingOrder(false);
    }
  };

  const handlePollShippitReturn = async () => {
    const numericOrderId = Number(orderId);
    const returnOrderId = shippitReturn?.return.return_order_id;
    if (!Number.isInteger(numericOrderId) || numericOrderId <= 0 || !returnOrderId) {
      setMessage({ type: "error", text: "Accept a quote before refreshing Shippit status." });
      return;
    }

    setPollingShippitReturn(true);
    setMessage(null);
    try {
      const response = await getShippitReturnOrder(numericOrderId, returnOrderId);
      applyShipmentResponse(response);
      setMessage({
        type: "success",
        text: "Shippit return status refreshed. This read does not confirm the order or book a courier.",
      });
    } catch (error: any) {
      setMessage({ type: "error", text: shippitErrorMessage(error, "Failed to poll Shippit return.") });
    } finally {
      setPollingShippitReturn(false);
    }
  };

  const handleFetchLabel = async () => {
    const numericOrderId = Number(orderId);
    const returnOrderId = shippitReturn?.return.return_order_id;
    if (!labelReady && workflowStage !== "booked" && workflowStage !== "label_requested" && workflowStage !== "ready_to_ship") {
      setMessage({ type: "error", text: "Request the label before printing it." });
      return;
    }
    if (!Number.isInteger(numericOrderId) || numericOrderId <= 0 || !returnOrderId) {
      setMessage({ type: "error", text: "Confirm the order before printing its label." });
      return;
    }

    setFetchingLabel(true);
    setMessage(null);
    try {
      const response = await fetchShippitReturnLabel(numericOrderId, returnOrderId);
      applyShipmentResponse(response);
      setMessage({ type: "success", text: "Return label retrieved." });
    } catch (error: any) {
      setMessage({ type: "error", text: shippitErrorMessage(error, "Failed to retrieve the return label.") });
    } finally {
      setFetchingLabel(false);
    }
  };

  const handlePreviewQuote = async () => {
    const numericOrderId = Number(orderId);
    if (!Number.isInteger(numericOrderId) || numericOrderId <= 0) {
      setMessage({ type: "error", text: "Enter a valid WooCommerce order ID first." });
      return;
    }
    if (!activeReturnCase) {
      setMessage({ type: "error", text: "Save the return case before requesting a quote." });
      return;
    }
    if (returnParcels.length === 0 || returnParcels.some(parcel => (
      parcel.qty <= 0
      || parcel.weight_kg <= 0
      || parcel.length_cm <= 0
      || parcel.width_cm <= 0
      || parcel.height_cm <= 0
    ))) {
      setMessage({ type: "error", text: "Every parcel requires positive quantity, weight, length, width, and height before quoting." });
      return;
    }

    setPreviewingQuote(true);
    setMessage(null);
    try {
      const response = await previewShippitReturnQuote({
        orderId: numericOrderId,
        returnId: activeReturnCase.id,
        parcels: returnParcels,
        parcelSource,
        mode: "returns_api",
      });
      setQuotePreview(response);
      setSelectedQuote(null);
      setWorkflowStage(current => current === "not_quoted" ? "quoted" : current);
      setMessage({ type: "success", text: "Prices loaded. No Shippit order was created." });
    } catch (error: any) {
      setQuotePreview(null);
      setMessage({ type: "error", text: error.message || "Failed to preview return quote." });
    } finally {
      setPreviewingQuote(false);
    }
  };

  const handleStatusChange = async (returnCase: ReturnCase, status: ReturnStatus) => {
    setSaving(true);
    setMessage(null);
    try {
      const updated = await updateReturn(returnCase.id, { status });
      setReturns(prev => prev.map(item => item.id === updated.id ? updated : item));
      setMessage({ type: "success", text: `Return #${updated.id} updated.` });
    } catch (error: any) {
      setMessage({ type: "error", text: error.message || "Failed to update return case." });
    } finally {
      setSaving(false);
    }
  };

  const handlePreviewCancellation = async (returnCase: ReturnCase) => {
    setPreviewingCancellation(true);
    setMessage(null);
    setCancelPreview(null);
    setReturnPendingCancellation(returnCase);
    setCancelOperationId(null);
    try {
      setCancelPreview(await previewReturnCancellation(returnCase));
    } catch (error: any) {
      setReturnPendingCancellation(null);
      setMessage({ type: "error", text: shippitErrorMessage(error, "Failed to verify return cancellation.") });
    } finally {
      setPreviewingCancellation(false);
    }
  };

  const handleCancelReturn = async () => {
    if (!returnPendingCancellation || !cancelPreview?.cancellable) return;

    setCancellingReturn(true);
    setMessage(null);
    const operationId = cancelOperationId ?? crypto.randomUUID();
    setCancelOperationId(operationId);
    try {
      const result = await cancelReturn({
        returnId: returnPendingCancellation.id,
        orderId: returnPendingCancellation.order_id,
        operationId,
      });
      const restoredQuantity = result.inventory_reversals.reduce(
        (total, reversal) => total + reversal.quantity_restored,
        0,
      );
      setReturnPendingCancellation(null);
      setCancelPreview(null);
      setCancelOperationId(null);
      await loadReturns();
      setMessage({
        type: "success",
        text: restoredQuantity > 0
          ? `Return #${result.return_id} cancelled and ${restoredQuantity} recorded stock units restored.`
          : `Return #${result.return_id} cancelled. No recorded inventory deduction required reversal.`,
      });
    } catch (error: any) {
      setMessage({ type: "error", text: shippitErrorMessage(error, "Failed to cancel return.") });
    } finally {
      setCancellingReturn(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Returns
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Analytics-owned return cases track return workflow separately from WooCommerce refund status and Shippit shipment handling.
      </Typography>

      {message ? (
        <Alert severity={message.type} sx={{ mb: 2 }}>
          {message.text}
        </Alert>
      ) : null}

      <Paper ref={returnFormRef} sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          {activeReturnCase ? `Return Case #${activeReturnCase.id}` : "Create Return Case"}
        </Typography>
        {editingOpenRequestedCase ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            Status is Requested. Edit the return lines and case fields, save them, then follow the return shipment steps below.
          </Alert>
        ) : null}
        <Stack spacing={2}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              label="WooCommerce Order ID"
              value={orderId}
              onChange={(event) => {
                setOrderId(event.target.value);
                setReturnableOrder(null);
                setReturnLineQty({});
                setActiveReturnCase(null);
                setShippitReturn(null);
                setQuotePreview(null);
                setSelectedQuote(null);
                setWorkflowStage("not_quoted");
                setShippitState("");
                setReturnParcels([]);
                setRecommendedReturnParcels([]);
                setParcelSource("ny_recommendation");
                setUseReturnSenderOverride(false);
                setOriginalReturnSender(emptyReturnSender);
                setReturnSender(emptyReturnSender);
              }}
              type="number"
              inputProps={{ min: 1 }}
              disabled={Boolean(activeReturnCase)}
              sx={{ minWidth: 220 }}
            />
            <TextField
              label="Reason"
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                invalidateOpenQuote();
              }}
              disabled={caseFieldsLocked}
              sx={{ minWidth: 260 }}
            />
            <TextField
              label="Resolution"
              value={resolution}
              onChange={(event) => {
                setResolution(event.target.value);
                invalidateOpenQuote();
              }}
              disabled={caseFieldsLocked}
              sx={{ minWidth: 260 }}
            />
          </Stack>
          <Stack direction="row" spacing={2} alignItems="center">
            <Button variant="outlined" onClick={handleLoadReturnableItems} disabled={loadingReturnableItems || saving}>
              {loadingReturnableItems ? "Loading Items..." : "Load Returnable Items"}
            </Button>
            <Button variant="outlined" onClick={handleSelectAllReturnableQty} disabled={!returnableOrder || saving || caseFieldsLocked}>
              Select All Returnable Qty
            </Button>
            <Button variant="outlined" onClick={handleClearReturnQty} disabled={!returnableOrder || saving || caseFieldsLocked}>
              Clear Qty
            </Button>
            {returnableOrder ? (
              <Typography variant="body2" color="text.secondary">
                Order #{returnableOrder.order.number}: {returnableOrder.items.length} physical item rows
              </Typography>
            ) : null}
          </Stack>
          {returnableOrder ? (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Item</TableCell>
                  <TableCell>SKU</TableCell>
                  <TableCell align="right">Ordered</TableCell>
                  <TableCell align="right">Already Return/Refund</TableCell>
                  <TableCell align="right">Returnable</TableCell>
                  <TableCell align="right">Return Qty</TableCell>
                  <TableCell>Parcel Data</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {returnableOrder.items.map(item => {
                  const ownQty = editingOpenRequestedCase ? qtyOnOpenCase(activeReturnCase, item.order_item_id) : 0;
                  const returnableQty = item.returnable_qty + ownQty;
                  const alreadyQty = Math.max(0, item.existing_return_qty - ownQty);
                  return (
                  <TableRow key={item.order_item_id}>
                    <TableCell>{item.product_name}</TableCell>
                    <TableCell>{item.sku || "-"}</TableCell>
                    <TableCell align="right">{item.ordered_qty}</TableCell>
                    <TableCell align="right">{alreadyQty + item.refunded_qty}</TableCell>
                    <TableCell align="right">{returnableQty}</TableCell>
                    <TableCell align="right">
                      <TextField
                        size="small"
                        type="number"
                        value={returnLineQty[item.order_item_id] ?? ""}
                        onChange={(event) => {
                          setReturnLineQty(prev => ({ ...prev, [item.order_item_id]: event.target.value }));
                          invalidateOpenQuote();
                        }}
                        disabled={caseFieldsLocked}
                        inputProps={{ min: 0, max: returnableQty, step: 1 }}
                        sx={{ width: 110 }}
                      />
                    </TableCell>
                    <TableCell>
                      {item.weight_g}g, {item.length_cm} x {item.width_cm} x {item.height_cm}cm
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : null}
          {returnableOrder ? (
            <Box>
              <Divider sx={{ mb: 2 }} />
              <FormControlLabel
                control={(
                  <Checkbox
                    checked={useReturnSenderOverride}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setUseReturnSenderOverride(checked);
                      if (!checked) {
                        setReturnSender(originalReturnSender);
                      }
                      invalidateOpenQuote();
                    }}
                    disabled={caseFieldsLocked}
                  />
                )}
                label="Use a different return sender address"
              />
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {useReturnSenderOverride
                  ? "Use this when the person physically returning the parcel is not at the originating order address. The WooCommerce order is not modified."
                  : "This is the original order recipient address. Saving and creating the return sends these values. The WooCommerce order is not modified."}
              </Typography>
              <Stack spacing={2}>
                {useReturnSenderOverride ? (
                  <Alert severity="warning">
                    Quotes and the final Shippit return will use this sender snapshot instead of the order address.
                  </Alert>
                ) : null}
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <TextField label="Return Sender Name" value={returnSender.name} onChange={(event) => updateReturnSender("name", event.target.value)} disabled={caseFieldsLocked || !useReturnSenderOverride} required fullWidth />
                    <TextField label="Company" value={returnSender.company_name || ""} onChange={(event) => updateReturnSender("company_name", event.target.value)} disabled={caseFieldsLocked || !useReturnSenderOverride} fullWidth />
                    <TextField label="Phone" value={returnSender.phone || ""} onChange={(event) => updateReturnSender("phone", event.target.value)} disabled={caseFieldsLocked || !useReturnSenderOverride} required fullWidth />
                    <TextField label="Email" value={returnSender.email || ""} onChange={(event) => updateReturnSender("email", event.target.value)} disabled={caseFieldsLocked || !useReturnSenderOverride} required fullWidth />
                  </Stack>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <TextField label="Address Line 1" value={returnSender.address_line_1} onChange={(event) => updateReturnSender("address_line_1", event.target.value)} disabled={caseFieldsLocked || !useReturnSenderOverride} required fullWidth />
                    <TextField label="Address Line 2" value={returnSender.address_line_2 || ""} onChange={(event) => updateReturnSender("address_line_2", event.target.value)} disabled={caseFieldsLocked || !useReturnSenderOverride} fullWidth />
                  </Stack>
                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <TextField label="Suburb" value={returnSender.suburb} onChange={(event) => updateReturnSender("suburb", event.target.value)} disabled={caseFieldsLocked || !useReturnSenderOverride} required fullWidth />
                    <TextField label="State" value={returnSender.state} onChange={(event) => updateReturnSender("state", event.target.value)} disabled={caseFieldsLocked || !useReturnSenderOverride} required fullWidth />
                    <TextField label="Postcode" value={returnSender.postcode} onChange={(event) => updateReturnSender("postcode", event.target.value)} disabled={caseFieldsLocked || !useReturnSenderOverride} required fullWidth />
                    <TextField label="Country Code" value={returnSender.country_code} onChange={(event) => updateReturnSender("country_code", event.target.value.toUpperCase())} disabled={caseFieldsLocked || !useReturnSenderOverride} required inputProps={{ maxLength: 2 }} fullWidth />
                  </Stack>
                  <TextField label="Pickup Instructions" value={returnSender.instructions || ""} onChange={(event) => updateReturnSender("instructions", event.target.value)} disabled={caseFieldsLocked || !useReturnSenderOverride} multiline minRows={2} />
                </Stack>
            </Box>
          ) : null}
          {activeReturnCase ? (
            <Box>
              <Divider sx={{ mb: 2 }} />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }} sx={{ mb: 2 }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="subtitle2">Shippit Parcel Configuration</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Dimensions are centimetres and weight is kilograms. Source: {parcelSource === "ny_recommendation" ? "NY Shipping recommendation" : "manual adjustment"}.
                  </Typography>
                </Box>
                <Button variant="outlined" onClick={addReturnParcel} disabled={Boolean(shippitReturn)}>Add Parcel</Button>
                <Button variant="outlined" onClick={resetReturnParcels} disabled={Boolean(shippitReturn) || recommendedReturnParcels.length === 0}>Reset to NY Recommendation</Button>
              </Stack>
              {loadingParcelPreview ? (
                <Typography variant="body2">Calculating NY Shipping parcel recommendation...</Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Parcel</TableCell>
                      <TableCell>Qty</TableCell>
                      <TableCell>Weight (kg)</TableCell>
                      <TableCell>Length (cm)</TableCell>
                      <TableCell>Width (cm)</TableCell>
                      <TableCell>Height (cm)</TableCell>
                      <TableCell>Action</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {returnParcels.map((parcel, index) => (
                      <TableRow key={index}>
                        <TableCell>{index + 1}</TableCell>
                        {(["qty", "weight_kg", "length_cm", "width_cm", "height_cm"] as Array<keyof ReturnParcel>).map(field => (
                          <TableCell key={field}>
                            <TextField
                              size="small"
                              type="number"
                              value={parcel[field]}
                              onChange={(event) => updateReturnParcel(index, field, event.target.value)}
                              disabled={Boolean(shippitReturn)}
                              inputProps={{ min: field === "qty" ? 1 : 0.01, step: field === "qty" ? 1 : 0.01 }}
                              sx={{ width: 110 }}
                            />
                          </TableCell>
                        ))}
                        <TableCell>
                          <Button size="small" color="error" onClick={() => removeReturnParcel(index)} disabled={Boolean(shippitReturn) || returnParcels.length <= 1}>
                            Remove
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Box>
          ) : null}
          {activeReturnCase ? (
            <ReturnShipmentSteps
              workflowStage={workflowStage}
              shippitState={shippitState}
              labelReady={labelReady}
              quotePreview={quotePreview}
              selectedQuote={selectedQuote}
              shippitReturn={shippitReturn}
              previewingQuote={previewingQuote}
              acceptingQuote={acceptingQuote}
              confirmingOrder={confirmingOrder}
              fetchingLabel={fetchingLabel}
              pollingShippitReturn={pollingShippitReturn}
              parcelsReady={returnParcels.length > 0 && returnParcels.every(parcel => (
                parcel.qty > 0 && parcel.weight_kg > 0 && parcel.length_cm > 0 && parcel.width_cm > 0 && parcel.height_cm > 0
              ))}
              onGetQuote={handlePreviewQuote}
              onSelectQuote={setSelectedQuote}
              onAcceptQuote={handleAcceptQuote}
              onConfirmOrder={handleConfirmOrder}
              onPrintLabel={handleFetchLabel}
              onRefreshStatus={handlePollShippitReturn}
              returnId={activeReturnCase.id}
              recipientEmail={customerReturnEmailRecipient(
                activeReturnCase.return_sender?.email,
                activeReturnCase.originating_order?.billing_email || returnableOrder?.order.customer.email,
              )}
            />
          ) : null}
          <TextField
            label="Return case notes"
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
              invalidateOpenQuote();
            }}
            disabled={caseFieldsLocked}
            multiline
            minRows={2}
            helperText="Stored on the return case. Use CRM Note below for customer follow-up."
          />
          {returnableOrder ? (
            <>
              <Divider />
              <CrmNoteComposer
                orderId={returnableOrder.order.id}
                customerEmail={returnableOrder.order.customer.email}
                customerPhone={returnableOrder.order.shipping_address.phone}
                customerName={`${returnableOrder.order.customer.first_name} ${returnableOrder.order.customer.last_name}`.trim()}
                triggerEvent="return"
              />
            </>
          ) : null}
          <Stack direction="row" spacing={2} alignItems="center">
            <FormControlLabel
              control={<Checkbox checked={refundExpected} onChange={(event) => { setRefundExpected(event.target.checked); invalidateOpenQuote(); }} disabled={caseFieldsLocked} />}
              label="Refund may be required"
            />
            <Button variant="outlined" onClick={handleCreate} disabled={saving || !returnableOrder || caseFieldsLocked}>
              {caseFieldsLocked && activeReturnCase ? `Return Case #${activeReturnCase.id} Saved` : "Save Return Case"}
            </Button>
            {activeReturnCase ? (
              <Button
                variant="text"
                onClick={() => {
                  setActiveReturnCase(null);
                  setShippitReturn(null);
                  setReturnableOrder(null);
                  setReturnLineQty({});
                  setQuotePreview(null);
                  setSelectedQuote(null);
                  setWorkflowStage("not_quoted");
                setShippitState("");
                  setReturnParcels([]);
                  setRecommendedReturnParcels([]);
                  setParcelSource("ny_recommendation");
                  setUseReturnSenderOverride(false);
                  setOriginalReturnSender(emptyReturnSender);
                  setReturnSender(emptyReturnSender);
                  setMessage({ type: "success", text: "Ready to start another return." });
                }}
              >
                Start Another Return
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Shippit Returns Diagnostics
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Probes Shippit returns endpoints from the WordPress Shippit extension. Enter a WooCommerce order ID above to include a controlled quote probe without creating a return shipment.
        </Typography>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
          <TextField
            label="Optional Return Tracking Number"
            value={probeTrackingNumber}
            onChange={(event) => setProbeTrackingNumber(event.target.value)}
            sx={{ minWidth: 280 }}
          />
          <Button variant="outlined" onClick={handleProbeShippit} disabled={probingShippit}>
            {probingShippit ? "Probing..." : "Probe Returns Endpoints"}
          </Button>
        </Stack>
        {probeResult ? (
          <Box sx={{ mt: 2 }}>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Environment: {probeResult.environment}; checked: {probeResult.checked_at}; order probe: {probeResult.order_id ?? "not supplied"}
            </Typography>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Check</TableCell>
                  <TableCell>Method</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Duration</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {probeResult.results.map(result => (
                  <TableRow key={result.name}>
                    <TableCell>{result.name}</TableCell>
                    <TableCell>{result.method}</TableCell>
                    <TableCell>{result.status_code ?? result.error ?? "No response"}</TableCell>
                    <TableCell>{result.duration_ms}ms</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        ) : null}
      </Paper>

      <Dialog
        open={returnPendingCancellation !== null}
        onClose={() => {
          if (!cancellingReturn) {
            setReturnPendingCancellation(null);
            setCancelPreview(null);
            setCancelOperationId(null);
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Cancel Return #{returnPendingCancellation?.id}?</DialogTitle>
        <DialogContent>
          {previewingCancellation || !cancelPreview ? (
            <Typography variant="body2">Verifying the live Shippit state and recorded inventory effects...</Typography>
          ) : (
            <Stack spacing={2}>
              <Alert severity={cancelPreview.cancellable ? "warning" : "error"}>
                {cancelPreview.cancellable
                  ? "This will cancel the live Shippit return when present, cancel the internal case, and reverse only inventory deductions recorded against this return."
                  : cancelPreview.reason}
              </Alert>
              <Typography variant="body2">
                Shippit: {cancelPreview.shippit_tracking_number || "No shipment created"}; state: {cancelPreview.shippit_state || "not created"}.
              </Typography>
              {cancelPreview.inventory_reversals.length > 0 ? (
                <Box>
                  <Typography variant="subtitle2">Recorded inventory to restore</Typography>
                  {cancelPreview.inventory_reversals.map(reversal => (
                    <Typography variant="body2" key={reversal.product_id}>
                      {reversal.product_name} × {reversal.quantity_restored}
                      {reversal.current_stock == null ? "" : ` (current stock ${reversal.current_stock})`}
                    </Typography>
                  ))}
                </Box>
              ) : (
                <Alert severity="info">
                  No inventory deduction is recorded against this return, so WooCommerce stock will not change.
                </Alert>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setReturnPendingCancellation(null);
              setCancelPreview(null);
              setCancelOperationId(null);
            }}
            disabled={cancellingReturn}
          >
            Keep Return
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleCancelReturn}
            disabled={cancellingReturn || !cancelPreview?.cancellable}
          >
            {cancellingReturn ? "Cancelling..." : "Cancel Return"}
          </Button>
        </DialogActions>
      </Dialog>

      <Paper sx={{ p: 3 }}>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between" sx={{ mb: 2 }}>
          <Typography variant="h6">Return Cases</Typography>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Status</InputLabel>
            <Select
              label="Status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as ReturnStatus | "all")}
            >
              {RETURN_STATUS_OPTIONS.map(option => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>

        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Return</TableCell>
              <TableCell>Order</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Reason</TableCell>
              <TableCell>Resolution</TableCell>
              <TableCell>Refund</TableCell>
              <TableCell>Lines</TableCell>
              <TableCell>Updated</TableCell>
              <TableCell>Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {returns.map(returnCase => (
              <Fragment key={returnCase.id}>
              <TableRow>
                <TableCell>#{returnCase.id}</TableCell>
                <TableCell>#{returnCase.order_id}</TableCell>
                <TableCell>
                  <Select
                    size="small"
                    value={returnCase.status}
                    disabled={saving || returnCase.status === "cancelled" || returnCase.status === "closed"}
                    onChange={(event) => handleStatusChange(returnCase, event.target.value as ReturnStatus)}
                  >
                    {RETURN_STATUS_OPTIONS.filter(option =>
                      option.value !== "all"
                      && (option.value !== "cancelled" || returnCase.status === "cancelled")
                    ).map(option => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </TableCell>
                <TableCell>{returnCase.reason}</TableCell>
                <TableCell>{returnCase.resolution}</TableCell>
                <TableCell>{returnCase.refund_expected ? "May be required" : "No"}</TableCell>
                <TableCell>{returnCase.lines?.length ?? 0}</TableCell>
                <TableCell>{returnCase.updated_at}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1}>
                    <Button size="small" onClick={() => {
                      setExpandedReturnId(expandedReturnId === returnCase.id ? null : returnCase.id);
                    }}>
                      {expandedReturnId === returnCase.id ? "Hide" : "View"}
                    </Button>
                    {returnCaseCanBeEdited(returnCase) ? (
                      <Button size="small" variant="outlined" onClick={() => {
                        void loadRequestedCaseForEditing(returnCase);
                      }}>
                        Edit
                      </Button>
                    ) : null}
                  </Stack>
                </TableCell>
              </TableRow>
              {expandedReturnId === returnCase.id ? (
                <TableRow>
                  <TableCell colSpan={9} sx={{ bgcolor: "action.hover", py: 2 }}>
                    <ReturnShipmentDetails
                      returnCase={returnCase}
                      openForEditing={returnCase.id === activeReturnCase?.id && editingOpenRequestedCase}
                      onCancel={() => handlePreviewCancellation(returnCase)}
                      previewingCancellation={previewingCancellation && returnPendingCancellation?.id === returnCase.id}
                      onReturnUpdated={replaceReturnCase}
                    />
                  </TableCell>
                </TableRow>
              ) : null}
              </Fragment>
            ))}
            {!loading && returns.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9}>
                  <Typography variant="body2" color="text.secondary">
                    No return cases found.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : null}
            {loading ? (
              <TableRow>
                <TableCell colSpan={9}>
                  <Typography variant="body2" color="text.secondary">
                    Loading return cases...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}

export default ReturnsPage;

function ReturnDocumentActions({
  returnId,
  trackingNumber,
  labelUrl,
  recipientEmail,
}: {
  returnId: number;
  trackingNumber: string;
  labelUrl: string;
  recipientEmail: string;
}) {
  const [busyAction, setBusyAction] = useState<"email" | "insert-letter" | "send" | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  const [sendTo, setSendTo] = useState(recipientEmail.trim());
  const [sendToError, setSendToError] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const documentsReady = returnId > 0 && Boolean(trackingNumber.trim());

  const openDocument = async (kind: "email" | "insert-letter") => {
    setBusyAction(kind);
    setNotice(null);
    try {
      const blob = await fetchReturnDocument(returnId, kind);
      const objectUrl = URL.createObjectURL(blob);
      const opened = window.open(objectUrl, "_blank", "noopener,noreferrer");
      setNotice({
        type: "success",
        text: opened
          ? kind === "email"
            ? "Opened the customer email document. It was not sent."
            : "Opened the insert letter for the packaging."
          : "The document was generated, but the browser blocked the new tab.",
      });
    } catch (error: unknown) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "The document could not be generated.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const openSendDialog = () => {
    setSendTo(recipientEmail.trim());
    setSendToError("");
    setConfirmSend(true);
  };

  const sendEmail = async () => {
    const recipient = sendTo.trim();
    if (!isSingleEmailAddress(recipient)) {
      setSendToError("Enter one email address.");
      return;
    }
    setSendToError("");
    setBusyAction("send");
    setNotice(null);
    try {
      await sendReturnDocumentEmail(returnId, recipient);
      setConfirmSend(false);
      setNotice({ type: "success", text: `Customer email sent for return #${returnId}.` });
    } catch (error: unknown) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "The customer email could not be sent.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <Stack spacing={1} sx={{ mt: 1 }}>
      <Typography variant="body2">
        Generate customer email creates the WC Integrated Returns Email document and does not send it. Send customer email sends that document only after you confirm. Generate insert letter creates the WC Integrated Returns Insert Letter, the printed note for the packaging.
      </Typography>
      {!documentsReady ? (
        <Typography variant="body2" color="text.secondary">
          These documents are available after the return tracking number is stored.
        </Typography>
      ) : !labelUrl.trim() ? (
        <Typography variant="body2" color="text.secondary">
          The label URL is not stored yet. Generate still creates the document and leaves that token blank.
        </Typography>
      ) : null}
      {notice ? <Alert severity={notice.type}>{notice.text}</Alert> : null}
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
        <Button
          size="small"
          variant="outlined"
          onClick={() => void openDocument("email")}
          disabled={!documentsReady || busyAction !== null}
        >
          {busyAction === "email" ? "Generating customer email..." : "Generate customer email"}
        </Button>
        <Button
          size="small"
          variant="contained"
          onClick={openSendDialog}
          disabled={!documentsReady || busyAction !== null}
        >
          Send customer email
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={() => void openDocument("insert-letter")}
          disabled={!documentsReady || busyAction !== null}
        >
          {busyAction === "insert-letter" ? "Generating insert letter..." : "Generate insert letter"}
        </Button>
      </Stack>
      <Dialog open={confirmSend} onClose={() => !busyAction && setConfirmSend(false)}>
        <DialogTitle>Send the customer email?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            This sends the WC Integrated Returns Email to the address in Send to and attaches the return label. Requesting the label does not send this email. The return sender and the order billing email stay unchanged.
          </Typography>
          <TextField
            label="Send to"
            value={sendTo}
            onChange={(event) => {
              setSendTo(event.target.value);
              setSendToError("");
            }}
            error={Boolean(sendToError)}
            helperText={sendToError || "One address. This send uses only the address in this field."}
            fullWidth
            autoFocus
            disabled={busyAction === "send"}
            margin="dense"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmSend(false)} disabled={busyAction === "send"}>Cancel</Button>
          <Button variant="contained" onClick={() => void sendEmail()} disabled={busyAction === "send"}>
            {busyAction === "send" ? "Sending..." : "Send the email"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

function PrintViaNyPrintAgentButton({
  returnId,
  labelUrl,
}: {
  returnId: number;
  labelUrl: string;
}) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const sendToAgent = async () => {
    if (!labelUrl.trim()) {
      setNotice({
        type: "error",
        text: "The return label URL is not stored yet. Print via NY Print Agent sends that stored PDF and does not request the label or allocate the courier.",
      });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const job = await printShippitReturnLabel(returnId);
      setNotice({
        type: "success",
        text: `Queued the return label as print job #${job.id} for the NY Print Agent.`,
      });
    } catch (error: unknown) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "The return label could not be sent to the NY Print Agent.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={1} alignItems="flex-start">
      {notice ? <Alert severity={notice.type}>{notice.text}</Alert> : null}
      <Button size="small" variant="outlined" onClick={() => void sendToAgent()} disabled={busy}>
        {busy ? "Sending to NY Print Agent..." : "Print via NY Print Agent"}
      </Button>
    </Stack>
  );
}

function TrackedReturnActions({
  returnCase,
  onReturnUpdated,
}: {
  returnCase: ReturnCase;
  onReturnUpdated: (returnCase: ReturnCase) => void;
}) {
  const [busyAction, setBusyAction] = useState<"request-label" | "print-label" | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const labelUrl = returnLabelUrl(returnCase);
  const showRequestLabel = returnLabelNotRequested(returnCase);

  const requestLabel = async () => {
    setBusyAction("request-label");
    setNotice(null);
    try {
      const response = await confirmShippitReturnOrder({
        orderId: returnCase.order_id,
        returnId: returnCase.id,
        mode: "returns_api",
      });
      onReturnUpdated(mergeShipmentResponse(returnCase, response));
      const stateText = response.shippit_state || response.return.state || "unknown";
      setNotice({
        type: "success",
        text: `Label requested. This allocates the courier. Shippit state: ${stateText}.`,
      });
    } catch (error: unknown) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to request the return label.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const printLabel = async () => {
    const returnOrderId = returnOrderIdForLabel(returnCase);
    if (!returnOrderId) {
      setNotice({ type: "error", text: "This return does not have a Shippit order id for its label." });
      return;
    }
    setBusyAction("print-label");
    setNotice(null);
    try {
      const response = await fetchShippitReturnLabel(returnCase.order_id, returnOrderId);
      const updated = mergeShipmentResponse(returnCase, response);
      onReturnUpdated(updated);
      const openedUrl = (response.return.label_url || returnLabelUrl(updated)).trim();
      if (!openedUrl) {
        setNotice({ type: "error", text: "The label was requested, but Shippit did not return a label URL." });
        return;
      }
      const opened = window.open(openedUrl, "_blank", "noopener,noreferrer");
      setNotice({
        type: opened ? "success" : "error",
        text: opened
          ? "Opened the return label PDF."
          : "The label URL was stored, but the browser blocked the new tab.",
      });
    } catch (error: unknown) {
      setNotice({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to retrieve the return label.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <Stack spacing={1} alignItems="flex-start" sx={{ mt: 1 }}>
      {notice ? <Alert severity={notice.type}>{notice.text}</Alert> : null}
      {showRequestLabel ? (
        <Stack spacing={1} alignItems="flex-start">
          <Typography variant="body2">
            There is no Book step. Australia Post then shows as Awaiting drop off. A courier collection shows as Return requested.
          </Typography>
          <Button
            size="small"
            variant="contained"
            onClick={() => void requestLabel()}
            disabled={busyAction !== null}
          >
            {busyAction === "request-label" ? "Requesting label..." : "Request label — this confirms the return and allocates the courier"}
          </Button>
        </Stack>
      ) : null}
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        {labelUrl ? (
          <Button size="small" variant="contained" href={labelUrl} target="_blank" rel="noopener noreferrer">
            Open label PDF
          </Button>
        ) : (
          <Button
            size="small"
            variant="outlined"
            onClick={() => void printLabel()}
            disabled={busyAction !== null}
          >
            {busyAction === "print-label" ? "Getting label..." : "Print label"}
          </Button>
        )}
      </Stack>
      <PrintViaNyPrintAgentButton returnId={returnCase.id} labelUrl={labelUrl} />
    </Stack>
  );
}

function ReturnShipmentDetails({
  returnCase,
  openForEditing,
  onCancel,
  previewingCancellation,
  onReturnUpdated,
}: {
  returnCase: ReturnCase;
  openForEditing: boolean;
  onCancel: () => void;
  previewingCancellation: boolean;
  onReturnUpdated: (returnCase: ReturnCase) => void;
}) {
  const order = returnCase.originating_order;
  const outbound = returnCase.outbound_shipment;
  const shipment = returnCase.return_shipment ?? {
    return_order_id: returnCase.shippit_return_order_id,
    tracking_number: returnCase.shippit_tracking_number,
    state: returnCase.shippit_state,
    label_url: returnCase.shippit_label_url,
  };
  const orderUrl = order ? wordpressAdminUrl(`admin.php?page=wc-orders&action=edit&id=${order.id}`) : null;
  const tracking = liveTrackingNumber(returnCase);
  const reportTrackingOnly = returnCase.status === "requested" && Boolean(tracking);

  return (
    <Stack spacing={2}>
      {openForEditing ? (
        <Alert severity="info">
          Status is Requested. Edit the lines and other case fields in the form above, save them, then follow the return shipment steps.
        </Alert>
      ) : null}
      {reportTrackingOnly ? (
        <Alert severity="warning">
          Status: Requested. Tracking: {tracking}. Shippit state: {returnCase.shippit_state || shipment.state || "unknown"}. This order is already in New Orders, so quote and accept stay unavailable.
        </Alert>
      ) : null}
      <Stack direction={{ xs: "column", md: "row" }} spacing={4}>
        <Box>
          <Typography variant="subtitle2">Originating order</Typography>
          <Typography variant="body2">
            {orderUrl ? <a href={orderUrl} target="_blank" rel="noopener noreferrer">Order #{order?.number ?? returnCase.order_id}</a> : `Order #${order?.number ?? returnCase.order_id}`}
          </Typography>
          <Typography variant="body2">Order status: {order?.status_label ?? "-"}</Typography>
          <Typography variant="body2">Outbound fulfillment: {order?.fulfillment_status ?? "-"}</Typography>
          <Typography variant="body2">
            Outbound tracking: {outbound?.tracking_url
              ? <a href={outbound.tracking_url} target="_blank" rel="noopener noreferrer">{outbound.tracking_number || "Open tracking"}</a>
              : outbound?.tracking_number || "-"}
          </Typography>
          <Typography variant="body2">Outbound courier: {outbound?.courier_name || "-"}</Typography>
        </Box>
        <Box>
          <Typography variant="subtitle2">Return shipment</Typography>
          <Typography variant="body2">Return status: {returnCase.status.replaceAll("_", " ")}</Typography>
          <Typography variant="body2">Shippit status: {shipment.state || "Not created"}</Typography>
          <Typography variant="body2">
            Return tracking: {shipment.tracking_url
              ? <a href={shipment.tracking_url} target="_blank" rel="noopener noreferrer">{shipment.tracking_number || "Open tracking"}</a>
              : shipment.tracking_number || "-"}
          </Typography>
          <Typography variant="body2">Courier: {shipment.courier_name || shipment.courier_type || "-"}</Typography>
          <Typography variant="body2">
            Quoted cost: {shipment.quoted_cost == null ? "Not recorded" : `${shipment.currency || order?.currency || ""} ${shipment.quoted_cost.toFixed(2)}`}
          </Typography>
          {tracking ? (
            <TrackedReturnActions returnCase={returnCase} onReturnUpdated={onReturnUpdated} />
          ) : shipment.label_url ? (
            <Button size="small" href={shipment.label_url} target="_blank" rel="noopener noreferrer">Open label PDF</Button>
          ) : null}
          <ReturnDocumentActions
            returnId={returnCase.id}
            trackingNumber={tracking}
            labelUrl={shipment.label_url || ""}
            recipientEmail={customerReturnEmailRecipient(
              returnCase.return_sender?.email,
              returnCase.originating_order?.billing_email,
            )}
          />
          {["requested", "approved"].includes(returnCase.status) ? (
            <Button
              size="small"
              color="error"
              variant="outlined"
              onClick={onCancel}
              disabled={previewingCancellation}
              sx={{ ml: shipment.label_url ? 1 : 0 }}
            >
              {previewingCancellation ? "Checking..." : "Cancel Return"}
            </Button>
          ) : null}
          {returnCase.cancellation_state && returnCase.cancellation_state !== "not_cancelled" ? (
            <Typography variant="body2">Cancellation state: {returnCase.cancellation_state.replaceAll("_", " ")}</Typography>
          ) : null}
        </Box>
      </Stack>
      <Box>
        <Typography variant="subtitle2">Return sender</Typography>
        <Typography variant="body2">
          {hasReturnSenderAddress(returnCase.return_sender)
            ? formatReturnSender(returnCase.return_sender)
            : "Originating WooCommerce order address"}
        </Typography>
      </Box>
      <Box>
        <Typography variant="subtitle2">Parcel details</Typography>
        {(shipment.parcels ?? []).length
          ? shipment.parcels!.map((parcel, index) => <Typography variant="body2" key={index}>{formatParcel(parcel, index)}</Typography>)
          : <Typography variant="body2" color="text.secondary">No parcel details recorded.</Typography>}
      </Box>
      <Box>
        <Typography variant="subtitle2">Returned items</Typography>
        {returnCase.lines.map(line => (
          <Typography variant="body2" key={line.id ?? `${line.order_item_id}-${line.sku}`}>
            {line.product_name || line.sku || `Order item ${line.order_item_id}`} × {line.qty}
          </Typography>
        ))}
      </Box>
      {(shipment.tracking_history ?? []).length ? (
        <Box>
          <Typography variant="subtitle2">Tracking history</Typography>
          {shipment.tracking_history!.map((event, index) => (
            <Typography variant="body2" key={index}>
              {String(event.status ?? event.current_state ?? "Update")}{event.date ? ` — ${String(event.date)}` : ""}
            </Typography>
          ))}
        </Box>
      ) : null}
    </Stack>
  );
}

const WORKFLOW_STATUS_TEXT: Record<ReturnWorkflowStage, string> = {
  not_quoted: "not quoted",
  quoted: "quoted",
  new_order: "new order",
  ready_to_ship: "ready to ship",
  label_requested: "label requested",
  booked: "booked",
};

function displayedReturnStatus(workflowStage: ReturnWorkflowStage, shippitState: string): string {
  const state = shippitState.trim();
  if (state) {
    return state;
  }
  return WORKFLOW_STATUS_TEXT[workflowStage];
}

function ReturnShipmentSteps({
  workflowStage,
  shippitState,
  labelReady,
  quotePreview,
  selectedQuote,
  shippitReturn,
  previewingQuote,
  acceptingQuote,
  confirmingOrder,
  fetchingLabel,
  pollingShippitReturn,
  parcelsReady,
  onGetQuote,
  onSelectQuote,
  onAcceptQuote,
  onConfirmOrder,
  onPrintLabel,
  onRefreshStatus,
  returnId,
  recipientEmail,
}: {
  workflowStage: ReturnWorkflowStage;
  shippitState: string;
  labelReady: boolean;
  quotePreview: ShippitReturnsProbeResult | null;
  selectedQuote: QuoteRow | null;
  shippitReturn: ShippitReturnOrderResponse | null;
  previewingQuote: boolean;
  acceptingQuote: boolean;
  confirmingOrder: boolean;
  fetchingLabel: boolean;
  pollingShippitReturn: boolean;
  parcelsReady: boolean;
  onGetQuote: () => void;
  onSelectQuote: (quote: QuoteRow) => void;
  onAcceptQuote: () => void;
  onConfirmOrder: () => void;
  onPrintLabel: () => void;
  onRefreshStatus: () => void;
  returnId: number;
  recipientEmail: string;
}) {
  const orderExists = Boolean(shippitReturn?.return.return_order_id || shippitReturn?.return.tracking_number);
  const quoteRows = quotePreview ? extractQuoteRows(quotePreview) : [];
  const quoteSucceeded = workflowStage !== "not_quoted";
  const labelSucceeded = labelReady || workflowStage === "label_requested" || workflowStage === "booked";
  const labelUrl = shippitReturn?.return.label_url || "";
  const printSucceeded = Boolean(labelUrl);
  const currentStep = printSucceeded ? 5 : labelSucceeded ? 4 : orderExists ? 3 : quoteSucceeded ? 2 : 1;
  const statusText = displayedReturnStatus(
    workflowStage,
    shippitState || shippitReturn?.shippit_state || shippitReturn?.return.state || "",
  );

  const quoteList = quoteRows.length > 0 ? (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Courier</TableCell>
          <TableCell>Service</TableCell>
          <TableCell align="right">Price</TableCell>
          <TableCell>Transit</TableCell>
          <TableCell>Action</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {quoteRows.map((quote, index) => (
          <TableRow key={`${quote.courierType}-${quote.serviceLevel}-${index}`}>
            <TableCell>{quote.courierType}</TableCell>
            <TableCell>{quote.serviceLevel}</TableCell>
            <TableCell align="right">${quote.price.toFixed(2)}</TableCell>
            <TableCell>{quote.estimatedTransitTime || "-"}</TableCell>
            <TableCell>
              <Button
                size="small"
                variant={selectedQuote && quoteKey(selectedQuote) === quoteKey(quote) ? "contained" : "outlined"}
                onClick={() => onSelectQuote(quote)}
                disabled={workflowStage !== "quoted" && workflowStage !== "not_quoted"}
              >
                {selectedQuote && quoteKey(selectedQuote) === quoteKey(quote) ? "Selected" : "Select"}
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ) : null;
  const quoteButton = (
    <Button
      variant={currentStep === 1 ? "contained" : "outlined"}
      onClick={onGetQuote}
      disabled={!parcelsReady || previewingQuote || orderExists || (workflowStage === "quoted" && Boolean(quotePreview))}
    >
      {previewingQuote ? "Getting prices..." : "Get a quote — prices only"}
    </Button>
  );

  const steps = [
    {
      step: 1,
      title: "Get a quote — prices only",
      complete: quoteSucceeded,
      body: (
        <Stack spacing={1} alignItems="flex-start">
          <Typography variant="body2">No Shippit order yet.</Typography>
          {quoteButton}
          {quoteList}
        </Stack>
      ),
    },
    {
      step: 2,
      title: "Accept quote — create the Shippit order in New Orders",
      complete: orderExists,
      body: (
        <Stack spacing={1} alignItems="flex-start">
          <Typography variant="body2">
            The courier is not allocated. Leave the return here until you are ready to send the label to the customer.
          </Typography>
          <Typography variant="body2">
            {selectedQuote
              ? `Selected price: $${selectedQuote.price.toFixed(2)} ${selectedQuote.courierType}`
              : "Select a quoted price before this step can be used."}
          </Typography>
          <Button
            variant={currentStep === 2 ? "contained" : "outlined"}
            onClick={onAcceptQuote}
            disabled={!selectedQuote || workflowStage !== "quoted" || acceptingQuote || orderExists}
          >
            {acceptingQuote ? "Creating Shippit order..." : "Accept quote — create the Shippit order in New Orders"}
          </Button>
        </Stack>
      ),
    },
    {
      step: 3,
      title: "Request label — this confirms the return and allocates the courier",
      complete: labelSucceeded,
      body: (
        <Stack spacing={1} alignItems="flex-start">
          <Typography variant="body2">
            There is no Book step. Australia Post then shows as Awaiting drop off. A courier collection shows as Return requested.
          </Typography>
          <Button
            variant={currentStep === 3 ? "contained" : "outlined"}
            onClick={onConfirmOrder}
            disabled={!orderExists || labelSucceeded || confirmingOrder}
          >
            {confirmingOrder ? "Requesting label..." : "Request label — this confirms the return and allocates the courier"}
          </Button>
        </Stack>
      ),
    },
    {
      step: 4,
      title: "Print label",
      complete: printSucceeded,
      body: (
        <Stack spacing={1} alignItems="flex-start">
          <Typography variant="body2">
            Open the PDF to print for the packaging or to attach to the customer email. The link lasts 7 days. Requesting the label again refreshes it.
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {labelUrl ? (
              <Button size="small" variant="contained" href={labelUrl} target="_blank" rel="noopener noreferrer">
                Print label
              </Button>
            ) : (
              <Button
                size="small"
                variant={currentStep === 4 ? "contained" : "outlined"}
                onClick={onPrintLabel}
                disabled={!labelSucceeded || fetchingLabel}
              >
                {fetchingLabel ? "Getting label..." : "Print label"}
              </Button>
            )}
            <Button
              size="small"
              variant="outlined"
              onClick={onPrintLabel}
              disabled={!printSucceeded || fetchingLabel}
            >
              {fetchingLabel ? "Refreshing label..." : "Request label again"}
            </Button>
          </Stack>
          {returnId > 0 ? (
            <PrintViaNyPrintAgentButton returnId={returnId} labelUrl={labelUrl} />
          ) : null}
        </Stack>
      ),
    },
    {
      step: 5,
      title: "Customer instructions",
      complete: false,
      body: (
        <Stack spacing={1} aria-label="Customer instructions">
          <Typography variant="body2">
            Shippit&apos;s automatic email goes to the shop address, not the customer. Send the customer the Natural Yield email, and put the printed note in the packaging.
          </Typography>
          <Typography variant="body2">
            Australia Post: the customer attaches the label and drops the parcel off when they are ready.
          </Typography>
          <Typography variant="body2">
            Aramex, Couriers Please, or Allied Express: the customer attaches the label, opens the tracking link, and requests the pickup when they are ready. No date or time can be chosen.
          </Typography>
          <Typography variant="body2">
            No Shippit portal step is required after these buttons succeed.
          </Typography>
          <ReturnDocumentActions
            returnId={returnId}
            trackingNumber={shippitReturn?.return.tracking_number || ""}
            labelUrl={labelUrl}
            recipientEmail={recipientEmail}
          />
        </Stack>
      ),
    },
  ];

  return (
    <Box>
      <Typography variant="subtitle2">Return shipment</Typography>
      <Typography variant="body2" sx={{ mt: 1 }}>
        Follow the steps in order. The current step is highlighted, and each later action stays unavailable until the step before it succeeds.
      </Typography>
      <Stack spacing={1.5} sx={{ mt: 1 }}>
        {steps.map(step => {
          const current = step.step === currentStep;
          return (
            <Box
              key={step.step}
              sx={{
                p: 1.5,
                borderRadius: 1,
                border: "1px solid",
                borderColor: current ? "primary.main" : "divider",
                bgcolor: current ? "action.selected" : "background.paper",
              }}
            >
              <Typography variant="subtitle2">
                {step.complete && !current ? "Done. " : current ? "Current. " : ""}
                {step.step}. {step.title}
              </Typography>
              <Box sx={{ mt: 1 }}>{step.body}</Box>
            </Box>
          );
        })}
      </Stack>
      <Typography variant="body2" sx={{ mt: 1.5 }}>
        Status: {statusText}
      </Typography>
      {shippitReturn ? (
        <Button size="small" variant="text" onClick={onRefreshStatus} disabled={pollingShippitReturn} sx={{ mt: 0.5 }}>
          {pollingShippitReturn ? "Refreshing..." : "Refresh status"}
        </Button>
      ) : null}
    </Box>
  );
}

function formatParcel(parcel: Record<string, unknown>, index: number): string {
  const length = parcel.length ?? "-";
  const width = parcel.width ?? "-";
  const depth = parcel.depth ?? parcel.height ?? "-";
  const weight = parcel.weight ?? "-";
  const type = parcel.package_type ? `, ${String(parcel.package_type)}` : "";
  const label = parcel.label_number ? `, label ${String(parcel.label_number)}` : "";
  return `Parcel ${index + 1}: ${String(length)} × ${String(width)} × ${String(depth)} m, ${String(weight)} kg${type}${label}`;
}

function formatReturnSender(sender: ReturnSender): string {
  return [
    sender.name,
    sender.company_name,
    sender.address_line_1,
    sender.address_line_2,
    `${sender.suburb} ${sender.state} ${sender.postcode}`.trim(),
    sender.country_code,
  ].filter(Boolean).join(", ");
}

function extractQuoteRows(result: ShippitReturnsProbeResult): QuoteRow[] {
  const body = result.body;
  if (!body || typeof body !== "object" || !("response" in body)) {
    return [];
  }

  const response = (body as { response?: unknown }).response;
  if (!Array.isArray(response)) {
    return [];
  }

  const rows: QuoteRow[] = [];
  response.forEach(serviceResult => {
    if (!serviceResult || typeof serviceResult !== "object") {
      return;
    }
    const service = serviceResult as { success?: unknown; courier_type?: unknown; service_level?: unknown; quotes?: unknown };
    if (service.success !== true || !Array.isArray(service.quotes)) {
      return;
    }
    service.quotes.forEach(quote => {
      if (!quote || typeof quote !== "object") {
        return;
      }
      const quoteData = quote as { price?: unknown; estimated_transit_time?: unknown };
      const price = Number(quoteData.price);
      if (!Number.isFinite(price)) {
        return;
      }
      rows.push({
        courierType: String(service.courier_type ?? ""),
        serviceLevel: String(service.service_level ?? ""),
        price,
        estimatedTransitTime: String(quoteData.estimated_transit_time ?? ""),
      });
    });
  });
  return rows.sort((left, right) => left.price - right.price);
}

function quoteKey(quote: QuoteRow): string {
  return `${quote.courierType}|${quote.serviceLevel}|${quote.price}`;
}

function shippitErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiRequestError)) {
    return error instanceof Error ? error.message : fallback;
  }

  const detail = readObject((error.responseBody as { detail?: unknown } | null)?.detail);
  const result = readObject(detail?.result);
  const body = readObject(result?.body);
  const errors = Array.isArray(body?.errors) ? body.errors : [];
  const firstError = readObject(errors[0]);
  const shippitMessage = typeof firstError?.message === "string" ? firstError.message : "";
  const shippitCode = typeof firstError?.code === "string" ? firstError.code : "";

  if (shippitMessage) {
    return shippitCode ? `Shippit error ${shippitCode}: ${shippitMessage}` : `Shippit error: ${shippitMessage}`;
  }

  return error.message || fallback;
}

function readObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
