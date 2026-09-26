import React from 'react';
import AdminLayout from '../../components/AdminLayout';
import FAQAccordion from '../../components/FAQAccordion';

// Internal help reference for Coral Gold staff (Batch 31) — a quick lookup
// for "how do I do X" while using the panel, not customer-facing.
const ITEMS = [
  {
    q: 'How do I add a new product?',
    a: 'Product module → Add Product → fill Image, Category, Design Number, Jewel Code, Gross Weight, Net Weight → Save.',
  },
  {
    q: 'How do I bulk import products from the ERP stock sheet?',
    a: 'Import → upload the Excel file → map columns if prompted → choose a duplicate-handling option (Skip Same / Style By Default / Merge Style / Add New Style, Old Delete) → Import.',
  },
  {
    q: 'How do I bulk import product images?',
    a: 'Stock Image (Media) → upload multiple images at once → they\'re auto-matched to products by filename = Style Number.',
  },
  {
    q: 'How do I create a new Wholesaler (Party) account?',
    a: 'Parties → Add Party → enter Party ID, Password, Company Name, Phone → Save, then share the ID/password with them directly.',
  },
  {
    q: 'How do I see what a party has ordered?',
    a: 'Quotations → view all quotations from every party, searchable by Quotation Number.',
  },
  {
    q: 'How do I clean up confusing ERP category codes (e.g. WTDC, LRDC)?',
    a: 'Use Category Mapping — create a friendly Parent Category (e.g. "Watch") and map the raw codes to it. Customers only ever see the Parent Category name.',
  },
  {
    q: 'How do I hide a category or product without deleting its data?',
    a: 'Use the Enable/Disable toggle on a Category, or Delete on a Product (which soft-deletes it) — data stays intact, it just stops showing to customers.',
  },
  {
    q: 'Where do I manage the logo, site icon, or lock the whole site with a password?',
    a: 'Settings module — covers Logo, Site Icon, Website Lock, field visibility switches, PDF layout, and the Wholesaler module on/off switch.',
  },
];

export default function FAQ() {
  return (
    <AdminLayout>
      <h1 className="admin-page-title" style={{ marginBottom: 20 }}>FAQ</h1>
      <div style={{ maxWidth: 760 }}>
        <FAQAccordion items={ITEMS} />
      </div>
    </AdminLayout>
  );
}
