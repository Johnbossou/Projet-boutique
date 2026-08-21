# Accessibility Guidelines for SGCI Frontend

This document provides guidelines for adding ARIA labels and improving accessibility in the SGCI frontend application.

## General Principles

1. **Semantic HTML**: Use semantic HTML elements whenever possible
2. **ARIA Labels**: Add descriptive ARIA labels for interactive elements
3. **Keyboard Navigation**: Ensure all interactive elements are keyboard accessible
4. **Focus Management**: Provide clear focus indicators
5. **Screen Reader Support**: Ensure content is readable by screen readers

## Component-Specific Guidelines

### Buttons
```tsx
// Good - with aria-label
<button aria-label="Add new product" onClick={handleAdd}>
  <Plus size={20} />
</button>

// Good - with aria-label and aria-describedby
<button 
  aria-label="Delete product" 
  aria-describedby="delete-warning"
  onClick={handleDelete}
>
  <Trash2 size={20} />
</button>
```

### Forms
```tsx
// Good - with proper labels and aria-describedby
<div>
  <label htmlFor="product-name">Product Name</label>
  <input
    id="product-name"
    aria-describedby="product-name-help"
    aria-required="true"
  />
  <span id="product-name-help">Enter the product name</span>
</div>
```

### Links
```tsx
// Good - with descriptive aria-label
<Link href="/products" aria-label="View all products">
  Products
</Link>
```

### Modals
```tsx
// Good - with proper ARIA attributes
<Modal
  aria-labelledby="modal-title"
  aria-describedby="modal-description"
  role="dialog"
  aria-modal="true"
>
  <h2 id="modal-title">Product Details</h2>
  <p id="modal-description">View and edit product information</p>
</Modal>
```

### Tables
```tsx
// Good - with proper ARIA attributes
<table aria-label="Products table">
  <caption>List of all products in inventory</caption>
  <thead>
    <tr>
      <th scope="col">Name</th>
      <th scope="col">Price</th>
      <th scope="col">Stock</th>
    </tr>
  </thead>
  <tbody>
    {/* Table rows */}
  </tbody>
</table>
```

### Navigation
```tsx
// Good - with proper ARIA attributes
<nav aria-label="Main navigation">
  <ul>
    <li><a href="/dashboard" aria-current="page">Dashboard</a></li>
    <li><a href="/products">Products</a></li>
    <li><a href="/sales">Sales</a></li>
  </ul>
</nav>
```

### Icons
```tsx
// Good - with aria-hidden for decorative icons
<Search aria-hidden="true" size={20} />

// Good - with aria-label for functional icons
<button aria-label="Search products">
  <Search size={20} />
</button>
```

### Alerts and Notifications
```tsx
// Good - with role="alert" for important messages
<div role="alert" aria-live="polite">
  Product successfully added
</div>

// Good - with role="status" for status updates
<div role="status" aria-live="polite">
  Saving changes...
</div>
```

### Progress Indicators
```tsx
// Good - with proper ARIA attributes
<div 
  role="progressbar" 
  aria-valuenow={75} 
  aria-valuemin={0} 
  aria-valuemax={100}
  aria-label="Loading progress"
>
  75%
</div>
```

## Priority Components to Update

1. **Navigation components** - Add aria-label to nav elements
2. **Form inputs** - Add proper labels and aria-describedby
3. **Buttons with icons** - Add aria-label for icon-only buttons
4. **Modals** - Add proper ARIA attributes
5. **Tables** - Add captions and scope attributes
6. **Pagination controls** - Add aria-label to pagination buttons
7. **Search inputs** - Add aria-label and aria-describedby
8. **Dropdown menus** - Add proper ARIA attributes

## Testing Checklist

- [ ] All buttons have descriptive labels
- [ ] All form inputs have associated labels
- [ ] All interactive elements are keyboard accessible
- [ ] Focus indicators are visible
- [ ] ARIA live regions are used for dynamic content
- [ ] Color contrast meets WCAG AA standards (4.5:1 for text)
- [ ] Images have alt text or are marked as decorative
- [ ] Skip navigation link is provided
- [ ] Page titles are descriptive
- [ ] Language is specified in HTML tag

## Implementation Notes

- Use `aria-hidden="true"` for decorative icons
- Use `aria-label` for elements without visible text
- Use `aria-labelledby` for elements labeled by other text
- Use `aria-describedby` for additional help text
- Use `aria-current="page"` for active navigation items
- Use `role` only when semantic HTML is not available
- Test with screen readers (NVDA, JAWS, VoiceOver)
- Test with keyboard navigation only

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [React Accessibility](https://react.dev/learn/accessibility)
- [Next.js Accessibility](https://nextjs.org/docs/app/building-your-application/optimizing/accessibility)
