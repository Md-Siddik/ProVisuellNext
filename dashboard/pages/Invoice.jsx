"use client"

import { useRef, useState } from "react"
import { getLocale } from "@/lib/i18n/locale"
import {
    ArrowLeft,
    Download,
    Printer,
} from "lucide-react"
import { useTranslation } from "@/lib/i18n"
import { computeInvoiceStatus } from "@/lib/invoices/status"

function nok(value = 0) {
    return `${Number(value || 0).toLocaleString("no-NO", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })} kr`
}

function formatDate(value) {
    if (!value) return "—"

    return new Date(value).toLocaleDateString(getLocale(), {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    })
}

function getWatermark(status, t) {
    const normalized = String(status || "issued").toLowerCase()

    if (
        normalized === "draft" ||
        normalized === "paid" ||
        normalized === "cancelled"
    ) {
        return t(`status.${normalized}`)
    }

    return null
}

const STATUS_CLASSNAME = {
    draft: "border-[#999] bg-[#f4f4f4] text-[#666]",
    issued: "border-[#ff4b00] bg-[#fff3ed] text-[#ff4b00]",
    unpaid: "border-[#ff4b00] bg-[#fff3ed] text-[#ff4b00]",
    partially_paid: "border-[#e79b00] bg-[#fff8e6] text-[#a86d00]",
    paid: "border-[#299545] bg-[#edf9f0] text-[#299545]",
    overdue: "border-[#d83229] bg-[#fff0ef] text-[#d83229]",
    cancelled: "border-[#777] bg-[#f2f2f2] text-[#666]",
}

const STATUS_LABEL_KEY = {
    draft: "status.draft",
    issued: "status.sent",
    unpaid: "status.unpaid",
    partially_paid: "invoicePage.statusPartiallyPaid",
    paid: "status.paid",
    overdue: "invoicePage.statusOverdue",
    cancelled: "status.cancelled",
}

function InvoiceStatus({ status }) {
    const { t } = useTranslation()
    const normalized = String(status || "issued").toLowerCase()

    const className =
        STATUS_CLASSNAME[normalized] || STATUS_CLASSNAME.issued

    const labelKey =
        STATUS_LABEL_KEY[normalized] || STATUS_LABEL_KEY.issued

    return (
        <span
            className={[
                "inline-flex items-center justify-center rounded-[4px] border",
                "px-[10px] py-[5px]",
                "text-[9px] font-[800] uppercase tracking-[0.08em]",
                className,
            ].join(" ")}
        >
            {t(labelKey)}
        </span>
    )
}

function InvoiceRow({ item }) {
    const { t } = useTranslation()
    const quantity = Number(item.quantity || 0)
    const unitPrice = Number(item.unitPrice || 0)
    const vatRate = Number(item.vatRate ?? 25)

    const lineSubtotal =
        item.subtotal ??
        quantity * unitPrice

    return (
        <tr className="break-inside-avoid border-b border-[#e9e9e9] last:border-b-0">
            <td className="px-[18px] py-[16px] align-top">
                <p className="text-[12.5px] font-[700] text-[#151515]">
                    {item.name ||
                        item.title ||
                        t("invoicePage.productService")}
                </p>

                {item.description && (
                    <p className="mt-[5px] max-w-[380px] text-[10.5px] leading-[1.55] text-[#777]">
                        {item.description}
                    </p>
                )}
            </td>

            <td className="px-[12px] py-[16px] text-right align-top text-[11.5px] text-[#555]">
                {quantity}
            </td>

            <td className="px-[12px] py-[16px] text-right align-top text-[11.5px] text-[#555]">
                {item.unit || t("invoicePage.pcs")}
            </td>

            <td className="px-[12px] py-[16px] text-right align-top text-[11.5px] text-[#555]">
                {nok(unitPrice)}
            </td>

            <td className="px-[12px] py-[16px] text-right align-top text-[11.5px] text-[#555]">
                {vatRate}%
            </td>

            <td className="px-[18px] py-[16px] text-right align-top text-[11.5px] font-[700] text-[#151515]">
                {nok(lineSubtotal)}
            </td>
        </tr>
    )
}

function DetailItem({ label, value }) {
    return (
        <div>
            <p className="text-[8.5px] font-[700] uppercase tracking-[0.08em] text-[#999]">
                {label}
            </p>

            <p className="mt-[5px] text-[11.5px] font-[650] text-[#222]">
                {value || "—"}
            </p>
        </div>
    )
}

export default function Invoice({
    invoice = {},
    onBack,
}) {
    const { t } = useTranslation()
    const items = invoice.items || []

    const subtotal =
        invoice.subtotal ??
        items.reduce((sum, item) => {
            const quantity = Number(
                item.quantity || 0
            )

            const unitPrice = Number(
                item.unitPrice || 0
            )

            return sum + quantity * unitPrice
        }, 0)

    const discount = Number(
        invoice.discount || 0
    )

    const taxableAmount = Math.max(
        0,
        subtotal - discount
    )

    const defaultVatRate = Number(
        invoice.vatRate ?? 25
    )

    const vatAmount =
        invoice.vatAmount ??
        items.reduce((sum, item) => {
            const quantity = Number(
                item.quantity || 0
            )

            const unitPrice = Number(
                item.unitPrice || 0
            )

            const vatRate = Number(
                item.vatRate ?? defaultVatRate
            )

            const lineSubtotal =
                item.subtotal ??
                quantity * unitPrice

            return (
                sum +
                lineSubtotal * (vatRate / 100)
            )
        }, 0)

    const grandTotal =
        invoice.grandTotal ??
        taxableAmount + vatAmount

    const amountPaid = Number(
        invoice.amountPaid || 0
    )

    const balanceDue = Math.max(
        0,
        grandTotal - amountPaid
    )

    // Same rule as the API and the invoice email (lib/invoices/status.js).
    const effectiveStatus = computeInvoiceStatus(invoice)
    const watermark = getWatermark(
        effectiveStatus,
        t
    )

    const sellerName =
        invoice.seller?.name || "ProVisuell"

    const orgNumber =
        invoice.seller?.orgNumber || "—"

    const vatRegistered =
        invoice.seller?.vatRegistered !== false

    const documentRef = useRef(null)
    const [downloading, setDownloading] = useState(false)
    const [downloadError, setDownloadError] = useState("")

    const printInvoice = () => {
        window.print()
    }

    // Renders the actual invoice document to an image and lays it into a
    // real multi-page A4 PDF that gets saved to disk — unlike "Skriv ut",
    // this needs no print dialog or "save as PDF" step from the user.
    const downloadPdf = async () => {
        const node = documentRef.current

        if (!node || downloading) return

        setDownloading(true)
        setDownloadError("")

        try {
            if (document.fonts?.ready) {
                await document.fonts.ready
            }

            // Loaded only when a PDF is actually requested (~0.5 MB of JS the
            // invoice view itself doesn't need).
            const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")])
            const canvas = await html2canvas(node, {
                scale: 2,
                backgroundColor: "#ffffff",
                useCORS: true,
                logging: false,

                // PDF rendering will always use desktop invoice dimensions
                windowWidth: 1280,
                windowHeight: 1600,

                scrollX: 0,
                scrollY: 0,

                onclone: (clonedDocument) => {
                    const invoiceNode =
                        clonedDocument.querySelector(
                            '[data-invoice-document="true"]'
                        )

                    if (invoiceNode) {
                        invoiceNode.style.width = "980px"
                        invoiceNode.style.minWidth = "980px"
                        invoiceNode.style.maxWidth = "980px"
                        invoiceNode.style.margin = "0"
                        invoiceNode.style.boxShadow = "none"
                        invoiceNode.style.transform = "none"
                    }
                },
            })

            const imgData =
                canvas.toDataURL("image/png", 1.0)

            const pdf = new jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: "a4",
                compress: true,
            })

            const pageWidth =
                pdf.internal.pageSize.getWidth()

            const pageHeight =
                pdf.internal.pageSize.getHeight()

            const imgWidth = pageWidth

            const imgHeight =
                (canvas.height * imgWidth) /
                canvas.width

            let heightLeft = imgHeight
            let position = 0

            pdf.addImage(
                imgData,
                "PNG",
                0,
                position,
                imgWidth,
                imgHeight,
                undefined,
                "FAST"
            )

            heightLeft -= pageHeight

            while (heightLeft > 0) {
                position =
                    heightLeft - imgHeight

                pdf.addPage()

                pdf.addImage(
                    imgData,
                    "PNG",
                    0,
                    position,
                    imgWidth,
                    imgHeight,
                    undefined,
                    "FAST"
                )

                heightLeft -= pageHeight
            }

            pdf.save(
                `${t("invoicePage.title")}-${invoice.invoiceNumber || t("status.draft")
                }.pdf`
            )
        } catch (err) {
            console.error(
                "PDF generation failed:",
                err
            )

            setDownloadError(
                t("invoicePage.pdfError")
            )
        } finally {
            setDownloading(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#ededed] px-[16px] py-[24px] font-sans text-[#181818] print:bg-white print:p-0">
            <div className="mx-auto mb-[18px] flex w-full max-w-[980px] items-center justify-between gap-[16px] print:hidden">
                <button
                    type="button"
                    onClick={onBack}
                    className="flex items-center gap-[8px] text-[13px] font-[600] text-[#555] transition-colors hover:text-black"
                >
                    <ArrowLeft size={17} />

                    {t("common.back")}
                </button>

                <div className="flex items-center gap-[10px]">
                    <button
                        type="button"
                        onClick={printInvoice}
                        className="flex h-[42px] items-center gap-[8px] rounded-[6px] border border-[#d5d5d5] bg-white px-[16px] text-[12px] font-[700] text-[#222] transition-colors hover:bg-[#f6f6f6]"
                    >
                        <Printer size={16} />

                        {t("common.print")}
                    </button>

                    <button
                        type="button"
                        onClick={downloadPdf}
                        disabled={downloading}
                        className="flex h-[42px] items-center gap-[8px] rounded-[6px] bg-[#ff4b00] px-[17px] text-[12px] font-[750] text-white transition-colors hover:bg-[#ec4600] disabled:opacity-60"
                    >
                        <Download size={16} />

                        {downloading ? t("invoicePage.generating") : t("invoicePage.downloadPdf")}
                    </button>
                </div>
            </div>

            {downloadError && (
                <div className="mx-auto mb-[18px] w-full max-w-[980px] rounded-[8px] border border-[#d83229]/40 bg-[#fff0ef] px-[16px] py-[10px] text-[12.5px] text-[#d83229] print:hidden">
                    {downloadError}
                </div>
            )}

            <main
                ref={documentRef}
                data-invoice-document="true"
                className="relative mx-auto min-h-[1180px] w-full max-w-[980px] overflow-hidden bg-white shadow-[0_15px_45px_rgba(0,0,0,0.12)] print:min-h-0 print:max-w-none print:shadow-none"
            >
                {watermark && (
                    <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center overflow-hidden">
                        <span className="rotate-[-28deg] select-none whitespace-nowrap text-[120px] font-[900] tracking-[0.12em] text-[rgba(0,0,0,0.035)]">
                            {watermark}
                        </span>
                    </div>
                )}

                <div className="relative z-10">
                    <div className="h-[7px] w-full bg-[#ff4b00]" />

                    <div className="px-[54px] pb-[46px] pt-[46px] max-md:px-[24px] print:px-[42px]">
                        <header className="flex items-start justify-between gap-[30px]">
                            <div>
                                <div className="notranslate flex items-center leading-none" translate="no">
                                    <span className="text-[32px] font-[850] tracking-[-0.045em] text-[#ff4b00]">
                                        Pro
                                    </span>

                                    <span className="text-[32px] font-[850] tracking-[-0.045em] text-[#151515]">
                                        Visuell
                                    </span>
                                </div>

                                <p className="mt-[7px] text-[8.5px] font-[700] uppercase tracking-[0.13em] text-[#777]">
                                    {t("invoicePage.tagline")}
                                </p>
                            </div>

                            <div className="text-right">
                                <p className="text-[10px] font-[800] uppercase tracking-[0.11em] text-[#ff4b00]">
                                    {t("invoicePage.title")}
                                </p>

                                <h1 className="mt-[5px] text-[25px] font-[850] tracking-[-0.025em] text-[#111]">
                                    {invoice.invoiceNumber ||
                                        "PV-2026-0001"}
                                </h1>

                                <div className="mt-[9px] flex justify-end">
                                    <InvoiceStatus
                                        status={effectiveStatus}
                                    />
                                </div>
                            </div>
                        </header>

                        <div className="mt-[41px] grid grid-cols-1 gap-[32px] border-y border-[#e6e6e6] py-[27px] md:grid-cols-2">
                            <section>
                                <p className="text-[9px] font-[800] uppercase tracking-[0.09em] text-[#999]">
                                    {t("invoicePage.from")}
                                </p>

                                <h2 className="notranslate mt-[9px] text-[14px] font-[800] text-[#151515]" translate="no">
                                    {sellerName}
                                </h2>

                                <div className="mt-[7px] space-y-[3px] text-[10.5px] leading-[1.5] text-[#666]">
                                    {invoice.seller?.address && (
                                        <p>
                                            {invoice.seller.address}
                                        </p>
                                    )}

                                    {(invoice.seller
                                        ?.postalCode ||
                                        invoice.seller?.city) && (
                                            <p>
                                                {
                                                    invoice.seller
                                                        ?.postalCode
                                                }{" "}
                                                {invoice.seller?.city}
                                            </p>
                                        )}

                                    <p>
                                        {invoice.seller?.country ||
                                            t("invoicePage.defaultCountry")}
                                    </p>

                                    <p className="pt-[4px]">
                                        {t("invoicePage.orgNumber")} {orgNumber}
                                        {vatRegistered &&
                                            orgNumber !== "—"
                                            ? t("invoicePage.vatSuffix")
                                            : ""}
                                    </p>

                                    <p>
                                        {invoice.seller?.email ||
                                            "info@provisuell.no"}
                                    </p>

                                    <p>
                                        {invoice.seller?.website ||
                                            "www.provisuell.no"}
                                    </p>
                                </div>
                            </section>

                            <section className="md:text-right">
                                <p className="text-[9px] font-[800] uppercase tracking-[0.09em] text-[#999]">
                                    {t("invoicePage.billedTo")}
                                </p>

                                <h2 className="mt-[9px] text-[14px] font-[800] text-[#151515]">
                                    {invoice.customer?.name ||
                                        invoice.customerName ||
                                        t("invoicePage.customerNamePlaceholder")}
                                </h2>

                                <div className="mt-[7px] space-y-[3px] text-[10.5px] leading-[1.5] text-[#666]">
                                    {(invoice.customer
                                        ?.address ||
                                        invoice.customerAddress) && (
                                            <p>
                                                {invoice.customer
                                                    ?.address ||
                                                    invoice.customerAddress}
                                            </p>
                                        )}

                                    {(invoice.customer
                                        ?.postalCode ||
                                        invoice.customer?.city) && (
                                            <p>
                                                {
                                                    invoice.customer
                                                        ?.postalCode
                                                }{" "}
                                                {invoice.customer?.city}
                                            </p>
                                        )}

                                    {invoice.customer
                                        ?.orgNumber && (
                                            <p>
                                                {t("invoicePage.orgNumber")}{" "}
                                                {
                                                    invoice.customer
                                                        .orgNumber
                                                }
                                            </p>
                                        )}

                                    <p>
                                        {invoice.customer?.email ||
                                            invoice.customerEmail ||
                                            "—"}
                                    </p>

                                    {invoice.customer?.phone && (
                                        <p>
                                            {invoice.customer.phone}
                                        </p>
                                    )}
                                </div>
                            </section>
                        </div>

                        <div className="grid grid-cols-2 gap-x-[20px] gap-y-[22px] py-[27px] sm:grid-cols-4">
                            <DetailItem
                                label={t("invoicePage.invoiceDate")}
                                value={formatDate(
                                    invoice.issueDate
                                )}
                            />

                            <DetailItem
                                label={t("invoicePage.dueDate")}
                                value={formatDate(
                                    invoice.dueDate
                                )}
                            />

                            <DetailItem
                                label={t("invoicePage.orderNumber")}
                                value={
                                    invoice.orderNumber || "—"
                                }
                            />

                            <DetailItem
                                label={t("invoicePage.deliveryDate")}
                                value={formatDate(
                                    invoice.deliveryDate
                                )}
                            />
                        </div>

                        {invoice.service && (
                            <div className="mb-[20px] rounded-[5px] border border-[#e8e8e8] bg-[#fafafa] px-[16px] py-[12px]">
                                <p className="text-[8px] font-[800] uppercase tracking-[0.08em] text-[#999]">
                                    {t("invoicePage.mainService")}
                                </p>

                                <p className="mt-[4px] text-[12px] font-[700] text-[#222]">
                                    {invoice.service}
                                </p>
                            </div>
                        )}

                        <div className="overflow-hidden rounded-[5px] border border-[#e5e5e5]">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[700px] border-collapse">
                                    <thead>
                                        <tr className="bg-[#171717] text-white">
                                            <th className="px-[18px] py-[13px] text-left text-[9.5px] font-[700] uppercase tracking-[0.04em]">
                                                {t("invoicePage.productService")}
                                            </th>

                                            <th className="px-[12px] py-[13px] text-right text-[9.5px] font-[700] uppercase">
                                                {t("invoicePage.qty")}
                                            </th>

                                            <th className="px-[12px] py-[13px] text-right text-[9.5px] font-[700] uppercase">
                                                {t("invoicePage.unit")}
                                            </th>

                                            <th className="px-[12px] py-[13px] text-right text-[9.5px] font-[700] uppercase">
                                                {t("invoicePage.priceExVat")}
                                            </th>

                                            <th className="px-[12px] py-[13px] text-right text-[9.5px] font-[700] uppercase">
                                                {t("invoicePage.vat")}
                                            </th>

                                            <th className="px-[18px] py-[13px] text-right text-[9.5px] font-[700] uppercase">
                                                {t("invoicePage.sum")}
                                            </th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {items.length > 0 ? (
                                            items.map(
                                                (item, index) => (
                                                    <InvoiceRow
                                                        key={
                                                            item._id ||
                                                            `${item.name}-${index}`
                                                        }
                                                        item={item}
                                                    />
                                                )
                                            )
                                        ) : (
                                            <tr>
                                                <td
                                                    colSpan={6}
                                                    className="px-[20px] py-[30px] text-center text-[12px] text-[#999]"
                                                >
                                                    {t("invoicePage.noLineItems")}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="mt-[29px] flex flex-col gap-[34px] md:flex-row md:items-start md:justify-between">
                            <section className="w-full max-w-[410px]">
                                <p className="text-[9px] font-[800] uppercase tracking-[0.08em] text-[#999]">
                                    {t("invoicePage.paymentInfo")}
                                </p>

                                <div className="mt-[12px] grid grid-cols-[112px_1fr] gap-y-[7px] text-[10.5px]">
                                    <span className="text-[#888]">
                                        {t("invoicePage.accountNumber")}
                                    </span>

                                    <span className="font-[650] text-[#222]">
                                        {invoice.payment
                                            ?.bankAccount || "—"}
                                    </span>

                                    {invoice.payment?.kid && (
                                        <>
                                            <span className="text-[#888]">
                                                {t("invoicePage.kid")}
                                            </span>

                                            <span className="font-[650] text-[#222]">
                                                {invoice.payment.kid}
                                            </span>
                                        </>
                                    )}

                                    {invoice.payment?.iban && (
                                        <>
                                            <span className="text-[#888]">
                                                {t("invoicePage.iban")}
                                            </span>

                                            <span className="font-[650] text-[#222]">
                                                {invoice.payment.iban}
                                            </span>
                                        </>
                                    )}

                                    {invoice.payment?.swift && (
                                        <>
                                            <span className="text-[#888]">
                                                {t("invoicePage.swiftBic")}
                                            </span>

                                            <span className="font-[650] text-[#222]">
                                                {invoice.payment.swift}
                                            </span>
                                        </>
                                    )}

                                    {invoice.payment
                                        ?.paymentReference && (
                                            <>
                                                <span className="text-[#888]">
                                                    {t("invoicePage.reference")}
                                                </span>

                                                <span className="font-[650] text-[#222]">
                                                    {
                                                        invoice.payment
                                                            .paymentReference
                                                    }
                                                </span>
                                            </>
                                        )}
                                </div>

                                {invoice.deliveryPlace && (
                                    <div className="mt-[20px]">
                                        <p className="text-[8.5px] font-[800] uppercase tracking-[0.08em] text-[#999]">
                                            {t("invoicePage.deliveryPlace")}
                                        </p>

                                        <p className="mt-[5px] text-[10.5px] leading-[1.5] text-[#666]">
                                            {invoice.deliveryPlace}
                                        </p>
                                    </div>
                                )}

                                {invoice.note && (
                                    <div className="mt-[18px]">
                                        <p className="text-[8.5px] font-[800] uppercase tracking-[0.08em] text-[#999]">
                                            {t("invoicePage.note")}
                                        </p>

                                        <p className="mt-[5px] text-[10.5px] leading-[1.55] text-[#666]">
                                            {invoice.note}
                                        </p>
                                    </div>
                                )}

                                {invoice.paymentTerms && (
                                    <div className="mt-[18px]">
                                        <p className="text-[8.5px] font-[800] uppercase tracking-[0.08em] text-[#999]">
                                            {t("invoicePage.paymentTerms")}
                                        </p>

                                        <p className="mt-[5px] text-[10.5px] leading-[1.55] text-[#666]">
                                            {invoice.paymentTerms}
                                        </p>
                                    </div>
                                )}
                            </section>

                            <section className="w-full max-w-[350px] break-inside-avoid">
                                <div className="space-y-[10px] text-[11.5px]">

                                    {/* SUBTOTAL */}

                                    <div className="grid grid-cols-[1fr_155px] items-center text-[#666]">
                                        <span>{t("invoicePage.subtotal")}</span>

                                        <span className="whitespace-nowrap text-right tabular-nums">
                                            {nok(subtotal)}
                                        </span>
                                    </div>

                                    {/* DISCOUNT */}

                                    {discount > 0 && (
                                        <div className="grid grid-cols-[1fr_155px] items-center text-[#666]">
                                            <span>{t("invoicePage.discount")}</span>

                                            <span className="whitespace-nowrap text-right tabular-nums">
                                                - {nok(discount)}
                                            </span>
                                        </div>
                                    )}

                                    {/* VAT */}

                                    <div className="grid grid-cols-[1fr_155px] items-center text-[#666]">
                                        <span>{t("invoicePage.vat")}</span>

                                        <span className="whitespace-nowrap text-right tabular-nums">
                                            {nok(vatAmount)}
                                        </span>
                                    </div>

                                    <div className="my-[13px] h-px w-full bg-[#dedede]" />

                                    {/* TOTAL */}

                                    <div className="grid grid-cols-[1fr_155px] items-end">
                                        <span className="text-[12px] font-[800] uppercase">
                                            {t("invoicePage.total")}
                                        </span>

                                        <span className="whitespace-nowrap text-right text-[24px] font-[850] leading-none tracking-[-0.03em] text-[#111] tabular-nums">
                                            {nok(grandTotal)}
                                        </span>
                                    </div>

                                    {/* PAID */}

                                    {amountPaid > 0 && (
                                        <>
                                            <div className="grid grid-cols-[1fr_155px] items-center pt-[9px] text-[#666]">
                                                <span>{t("invoicePage.paidLabel")}</span>

                                                <span className="whitespace-nowrap text-right tabular-nums">
                                                    - {nok(amountPaid)}
                                                </span>
                                            </div>

                                            {/* REMAINING */}

                                            <div className="grid min-h-[38px] grid-cols-[1fr_155px] items-center rounded-[4px] bg-[#fff1eb] px-[12px] py-[10px] font-[750] text-[#ff4b00]">
                                                <span>{t("invoicePage.remaining")}</span>

                                                <span className="whitespace-nowrap text-right tabular-nums">
                                                    {nok(balanceDue)}
                                                </span>
                                            </div>
                                        </>
                                    )}

                                    {/* UNPAID */}

                                    {amountPaid <= 0 &&
                                        grandTotal > 0 && (
                                            <div className="mt-[10px] rounded-[4px] bg-[#fff1eb] px-[12px] py-[10px]">
                                                <div className="grid grid-cols-[1fr_155px] items-center">
                                                    <span className="text-[10px] font-[700] uppercase tracking-[0.04em] text-[#ff4b00]">
                                                        {t("invoicePage.amountDue")}
                                                    </span>

                                                    <span className="whitespace-nowrap text-right text-[15px] font-[800] text-[#ff4b00] tabular-nums">
                                                        {nok(grandTotal)}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                </div>
                            </section>
                        </div>

                        <footer className="mt-[70px] border-t border-[#e5e5e5] pt-[18px]">
                            <div className="flex flex-col justify-between gap-[12px] sm:flex-row">
                                <div>
                                    <p className="notranslate text-[9px] font-[750] text-[#555]" translate="no">
                                        {sellerName}
                                    </p>

                                    <p className="mt-[3px] text-[8.5px] leading-[1.55] text-[#999]">
                                        {t("invoicePage.orgNumber")} {orgNumber}
                                        {vatRegistered &&
                                            orgNumber !== "—"
                                            ? t("invoicePage.vatSuffix")
                                            : ""}
                                    </p>
                                </div>

                                <div className="text-[8.5px] leading-[1.55] text-[#999] sm:text-right">
                                    <p>
                                        {invoice.seller?.email ||
                                            "info@provisuell.no"}
                                    </p>

                                    <p>
                                        {invoice.seller?.website ||
                                            "www.provisuell.no"}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-[16px] flex items-center gap-[8px]">
                                <div className="h-[3px] w-[61px] bg-[#ff4b00]" />

                                <div className="h-[3px] w-[12px] bg-[#171717]" />
                            </div>
                        </footer>
                    </div>
                </div>
            </main>
        </div>
    )
}