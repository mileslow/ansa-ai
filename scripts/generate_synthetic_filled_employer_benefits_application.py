#!/usr/bin/env python3
"""Generate a synthetic filled employer benefits application extraction fixture."""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / (
    "source-docs/01_employer-setup/employer-and-group-information/"
    "synthetic-filled-applications/"
    "01_northstar-fabrication_2026-synthetic-filled-employer-benefits-application.pdf"
)

NAVY = colors.HexColor("#16324F")
BLUE = colors.HexColor("#245B84")
PALE_BLUE = colors.HexColor("#EAF3F8")
PALE_GRAY = colors.HexColor("#F3F5F7")
MID_GRAY = colors.HexColor("#C7D0D9")
RED = colors.HexColor("#B42318")
GOLD = colors.HexColor("#E3A72F")
INK = colors.HexColor("#18212A")

styles = getSampleStyleSheet()
BODY = ParagraphStyle(
    "FixtureBody",
    parent=styles["BodyText"],
    fontName="Helvetica",
    fontSize=8.2,
    leading=10.2,
    textColor=INK,
    spaceAfter=0,
)
SMALL = ParagraphStyle(
    "FixtureSmall",
    parent=BODY,
    fontSize=7.1,
    leading=8.7,
)
TINY = ParagraphStyle(
    "FixtureTiny",
    parent=BODY,
    fontSize=6.3,
    leading=7.5,
)
TITLE = ParagraphStyle(
    "FixtureTitle",
    parent=BODY,
    fontName="Helvetica-Bold",
    fontSize=18,
    leading=20,
    textColor=NAVY,
    alignment=TA_LEFT,
    spaceAfter=4,
)
SUBTITLE = ParagraphStyle(
    "FixtureSubtitle",
    parent=BODY,
    fontSize=9,
    leading=11,
    textColor=BLUE,
    spaceAfter=5,
)
SECTION = ParagraphStyle(
    "FixtureSection",
    parent=BODY,
    fontName="Helvetica-Bold",
    fontSize=10,
    leading=11,
    textColor=colors.white,
)
CENTER = ParagraphStyle(
    "FixtureCenter",
    parent=BODY,
    alignment=TA_CENTER,
)


def p(text, style=BODY):
    return Paragraph(str(text).replace("&", "&amp;"), style)


def section(title):
    table = Table([[p(title, SECTION)]], colWidths=[7.25 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), BLUE),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    return table


def form_table(rows, widths=None, tiny=False):
    style = TINY if tiny else BODY
    data = []
    for row in rows:
        data.append([p(value, style) for value in row])
    if widths is None:
        widths = [1.35 * inch, 2.275 * inch, 1.35 * inch, 2.275 * inch]
    table = Table(data, colWidths=widths, repeatRows=0, hAlign="LEFT")
    commands = [
        ("GRID", (0, 0), (-1, -1), 0.45, MID_GRAY),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5),
        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 3.5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3.5),
    ]
    for r in range(len(data)):
        for c in range(0, len(data[r]), 2):
            commands.extend(
                [
                    ("BACKGROUND", (c, r), (c, r), PALE_BLUE),
                    ("FONTNAME", (c, r), (c, r), "Helvetica-Bold"),
                    ("TEXTCOLOR", (c, r), (c, r), NAVY),
                ]
            )
    table.setStyle(TableStyle(commands))
    return table


def data_table(headers, rows, widths, font_size=7.2):
    cell_style = ParagraphStyle(
        "DynamicCell",
        parent=BODY,
        fontSize=font_size,
        leading=font_size + 1.5,
    )
    header_style = ParagraphStyle(
        "DynamicHeader",
        parent=cell_style,
        fontName="Helvetica-Bold",
        textColor=colors.white,
        alignment=TA_CENTER,
    )
    data = [[p(value, header_style) for value in headers]]
    data.extend([[p(value, cell_style) for value in row] for row in rows])
    table = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), NAVY),
                ("GRID", (0, 0), (-1, -1), 0.45, MID_GRAY),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALE_GRAY]),
            ]
        )
    )
    return table


def note_box(title, text, accent=GOLD):
    data = [[p(f"<b>{title}</b><br/>{text}", SMALL)]]
    table = Table(data, colWidths=[7.25 * inch])
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFF7E6")),
                ("BOX", (0, 0), (-1, -1), 0.8, accent),
                ("LINEBEFORE", (0, 0), (0, -1), 4, accent),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return table


def header_footer(canvas, doc):
    width, height = letter
    canvas.saveState()
    canvas.setFillColor(RED)
    canvas.rect(0, height - 0.34 * inch, width, 0.34 * inch, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont("Helvetica-Bold", 10.5)
    canvas.drawCentredString(
        width / 2,
        height - 0.225 * inch,
        "SYNTHETIC / NOT A REAL EMPLOYER",
    )
    canvas.setStrokeColor(MID_GRAY)
    canvas.line(0.55 * inch, 0.43 * inch, width - 0.55 * inch, 0.43 * inch)
    canvas.setFillColor(NAVY)
    canvas.setFont("Helvetica-Bold", 7.2)
    canvas.drawString(0.55 * inch, 0.25 * inch, "NORTHSTAR FABRICATION TEST COMPANY")
    canvas.setFont("Helvetica", 7.2)
    canvas.drawRightString(
        width - 0.55 * inch,
        0.25 * inch,
        f"SYNTHETIC EXTRACTION FIXTURE | PAGE {doc.page}",
    )
    canvas.restoreState()


def build_story():
    story = []
    story.extend(
        [
            Spacer(1, 0.02 * inch),
            p("Filled Employer Benefits Application", TITLE),
            p(
                "Synthetic completed-form fixture for extraction testing. All entities, people, IDs, contacts, plans, rates, and signatures are invented.",
                SUBTITLE,
            ),
            form_table(
                [
                    ["Application ID", "NFAB-2026-0001", "Status", "Completed - synthetic"],
                    ["Plan year", "2026", "Coverage effective", "01/01/2026"],
                    ["Enrollment window", "11/03/2025 - 11/14/2025", "Submitted", "10/24/2025"],
                ]
            ),
            Spacer(1, 6),
            section("1. Employer identity and primary contact"),
            form_table(
                [
                    ["Legal name", "Northstar Fabrication Test Company", "DBA", "Northstar Fabrication"],
                    ["FEIN", "99-0000123 (fictional)", "State employer ID", "ID-TEST-88421"],
                    ["Business type", "[X] C corporation  [ ] LLC  [ ] Nonprofit", "Industry", "Precision metal fabrication (synthetic)"],
                    ["Street address", "2400 Foundry Loop", "City / state / ZIP", "Boise, ID 83702"],
                    ["Main phone", "208-555-0106", "Website", "https://northstar-fabrication.test"],
                    ["Primary contact", "Avery Chen - Synthetic HR Director", "Contact email", "avery.chen@northstar-fabrication.test"],
                    ["Direct phone", "208-555-0112", "General benefits email", "benefits@northstar-fabrication.test"],
                ]
            ),
            Spacer(1, 6),
            section("2. Workforce and eligibility census summary"),
            data_table(
                ["Workforce measure", "Count", "Workforce measure", "Count"],
                [
                    ["Total employees", "148", "Benefits eligible", "117"],
                    ["Full time", "121", "Expected enrolling", "104"],
                    ["Part time", "16", "Expected waiving", "13"],
                    ["Seasonal", "11", "Current COBRA participants", "3"],
                    ["Work locations", "2", "Average FT weekly hours", "38"],
                ],
                [2.2 * inch, 0.8 * inch, 2.6 * inch, 0.8 * inch],
            ),
            Spacer(1, 6),
            section("3. Eligibility, waiting period, and payroll"),
            form_table(
                [
                    ["Eligible classes", "Regular employees scheduled 30+ hours/week", "Dependent eligibility", "Spouse, domestic partner, children through end of month turning 26"],
                    ["Waiting rule", "First of month after 30 calendar days", "Rehire rule", "Waive waiting period if rehired within 13 weeks"],
                    ["Hours threshold", "30 hours/week", "Measurement method", "Monthly measurement"],
                    ["Payroll frequency", "Biweekly - 26 payrolls/year", "First deduction", "12/19/2025"],
                    ["Contribution basis", "Monthly rates converted across 26 payrolls", "Section 125", "[X] Pre-tax medical/dental/vision  [ ] Post-tax only"],
                ],
                tiny=True,
            ),
            Spacer(1, 6),
            note_box(
                "Extraction decoys - do not treat as employer data",
                "Formatting examples only: FEIN <b>12-3456789</b>; sample effective date <b>01/01/2025</b>; sample support phone <b>208-555-0199</b>. The completed values are in the labeled fields above.",
            ),
            PageBreak(),
        ]
    )

    story.extend(
        [
            p("Benefit elections and employer contributions", TITLE),
            p("Checked options are elected. Unchecked options are visible negative examples.", SUBTITLE),
            section("4. Insurance plan selections"),
            data_table(
                ["Benefit", "Selection", "Carrier / plan", "Funding and key terms"],
                [
                    ["Medical", "[X] Selected", "Pioneer Health Test Insurance - PPO 1500 HSA", "Employer tier contribution shown below; HSA-compatible HDHP"],
                    ["Medical alternative", "[ ] Not selected", "Regional HMO Silver", "Declined option - do not extract as elected"],
                    ["Dental", "[X] Selected", "Summit Dental Test - DPPO", "Employer pays 50% of employee-only premium"],
                    ["Vision", "[X] Selected", "ClearView Test Vision - 12/12/24", "Employer pays 50% of employee-only premium"],
                    ["Basic life and AD&D", "[X] Selected", "Keystone Test Life", "1x annual salary, maximum $150,000; employer paid"],
                    ["Short-term disability", "[X] Selected", "Keystone Test STD", "60% weekly earnings, $1,500 max, 7-day elimination; employer paid"],
                    ["Long-term disability", "[X] Selected", "Keystone Test LTD", "60% monthly earnings, $7,500 max, 90-day elimination; employer paid"],
                    ["Voluntary accident", "[ ] Not selected", "Beacon Accident Test Plan", "Declined option - no payroll deduction"],
                ],
                [1.18 * inch, 0.9 * inch, 2.25 * inch, 2.92 * inch],
                font_size=6.9,
            ),
            Spacer(1, 6),
            section("5. Account-based benefit selections"),
            data_table(
                ["Account", "Offered?", "Administrator", "Employer / employee terms"],
                [
                    ["HSA", "[X] Yes", "Evergreen Accounts Test Services", "Employer $750 employee-only / $1,500 family annually; employee may contribute to legal limit"],
                    ["HRA", "[ ] No", "None", "Not offered; illustrative $2,000 HRA allowance below is a decoy"],
                    ["Health FSA", "[X] Yes", "Evergreen Accounts Test Services", "Employee election up to $3,400; employer contribution $0; $680 carryover"],
                    ["Dependent care FSA", "[X] Yes", "Evergreen Accounts Test Services", "Employee election up to $7,500; employer contribution $0"],
                    ["Limited-purpose FSA", "[ ] No", "None", "Not offered for this synthetic case"],
                ],
                [1.25 * inch, 0.8 * inch, 2.05 * inch, 3.15 * inch],
                font_size=6.9,
            ),
            Spacer(1, 6),
            section("6. Monthly medical contribution schedule"),
            data_table(
                ["Coverage tier", "Total premium", "Employer pays", "Employee pays"],
                [
                    ["Employee only", "$700.00", "$560.00", "$140.00"],
                    ["Employee + spouse", "$1,450.00", "$1,050.00", "$400.00"],
                    ["Employee + child(ren)", "$1,260.00", "$930.00", "$330.00"],
                    ["Family", "$2,050.00", "$1,450.00", "$600.00"],
                ],
                [2.25 * inch, 1.65 * inch, 1.65 * inch, 1.7 * inch],
            ),
            Spacer(1, 6),
            form_table(
                [
                    ["Dental contribution", "50% of employee-only; dependents employee paid", "Vision contribution", "50% of employee-only; dependents employee paid"],
                    ["Life / AD&D", "100% employer paid", "STD / LTD", "100% employer paid"],
                ],
                tiny=True,
            ),
            Spacer(1, 6),
            note_box(
                "Extraction decoys - rejected or illustrative values",
                "Prior-carrier sample group <b>OLD-GRP-0000</b>; illustrative HRA allowance <b>$2,000</b>; declined medical plan <b>Regional HMO Silver</b>; declined voluntary accident plan <b>Beacon Accident Test Plan</b>. None is an active election.",
            ),
            PageBreak(),
        ]
    )

    story.extend(
        [
            p("Administration, enrollment, and acknowledgments", TITLE),
            p("Final synthetic contacts, workflow choices, and sign-off fields.", SUBTITLE),
            section("7. Plan administrator and broker"),
            form_table(
                [
                    ["Plan administrator", "Morgan Rivera - Synthetic Benefits Administrator", "Administrator company", "Northstar Fabrication Test Company"],
                    ["Administrator email", "morgan.rivera@northstar-fabrication.test", "Administrator phone", "208-555-0116"],
                    ["Broker", "Jordan Patel - Synthetic Benefits Broker", "Brokerage", "Northwind Benefits Test Brokerage"],
                    ["Broker license / ID", "TEST-ID-BR-0042", "Broker email", "jordan.patel@northwind-benefits.test"],
                    ["Broker phone", "208-555-0118", "Broker address", "88 Compass Way, Boise, ID 83702"],
                ],
                tiny=True,
            ),
            Spacer(1, 6),
            section("8. Enrollment administration"),
            form_table(
                [
                    ["Enrollment method", "[X] Online portal  [ ] Paper-only  [ ] Passive enrollment", "Portal", "https://enroll.northstar-fabrication.test"],
                    ["Open enrollment", "11/03/2025 - 11/14/2025", "New-hire election due", "Within 25 days after eligibility notice"],
                    ["Default rule", "No default medical election; prior elections do not roll", "Waiver evidence", "Electronic attestation required"],
                    ["Billing", "[X] Consolidated invoice  [ ] Individual billing", "Eligibility feed", "Weekly test-format census file"],
                    ["COBRA vendor", "Continuation Services Test LLC", "COBRA email", "cobra@continuation-services.test"],
                ],
                tiny=True,
            ),
            Spacer(1, 6),
            section("9. Employer acknowledgments"),
            data_table(
                ["Check", "Acknowledgment"],
                [
                    ["[X]", "Workforce counts were reconciled for this synthetic fixture."],
                    ["[X]", "Official plan documents and carrier contracts control over this application."],
                    ["[X]", "Employees will receive applicable SBCs, notices, rates, and enrollment instructions."],
                    ["[X]", "All contacts, IDs, signatures, companies, and plan names in this file are fictional."],
                    ["[ ]", "Waiting-period exception requested."],
                    ["[ ]", "Alternate contribution schedule attached."],
                ],
                [0.75 * inch, 6.5 * inch],
            ),
            Spacer(1, 6),
            section("10. Synthetic signatures"),
            form_table(
                [
                    ["Employer signature", "/s/ Avery Chen - SYNTHETIC", "Title", "Synthetic HR Director"],
                    ["Employer signed", "10/24/2025", "Authority", "Authorized synthetic representative"],
                    ["Broker signature", "/s/ Jordan Patel - SYNTHETIC", "Broker signed", "10/24/2025"],
                ],
                tiny=True,
            ),
            Spacer(1, 6),
            note_box(
                "Extraction decoys - examples and rejected drafts",
                "Example broker <b>Taylor Example</b>, <b>taylor@example.test</b>; rejected draft administrator email <b>draft-admin@example.test</b>; proposed but rejected effective date <b>02/01/2026</b>; sample fax <b>208-555-0198</b>. Do not extract these as completed application values.",
            ),
            Spacer(1, 8),
            p(
                "SYNTHETIC CERTIFICATION: This document was generated solely for software extraction testing. It does not represent an employer, insurance policy, application, enrollment, or legal agreement.",
                ParagraphStyle(
                    "Certification",
                    parent=SMALL,
                    fontName="Helvetica-Bold",
                    textColor=RED,
                    alignment=TA_CENTER,
                    borderColor=RED,
                    borderWidth=0.8,
                    borderPadding=7,
                ),
            ),
        ]
    )
    return story


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUTPUT),
        pagesize=letter,
        leftMargin=0.625 * inch,
        rightMargin=0.625 * inch,
        topMargin=0.52 * inch,
        bottomMargin=0.58 * inch,
        title="Synthetic Filled Employer Benefits Application - Northstar Fabrication",
        author="Ansa synthetic fixture generator",
        subject="Synthetic extraction test fixture; not a real employer",
    )
    doc.build(build_story(), onFirstPage=header_footer, onLaterPages=header_footer)
    print(OUTPUT)


if __name__ == "__main__":
    main()
