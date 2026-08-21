import '@testing-library/jest-dom'
import { render, screen, fireEvent } from '@testing-library/react'
import { Pagination, SimplePagination } from '../Pagination'

describe('Pagination Component', () => {
  const defaultProps = {
    currentPage: 1,
    totalPages: 10,
    onPageChange: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders page number buttons', () => {
    render(<Pagination {...defaultProps} />)

    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '10' })).toBeInTheDocument()
  })

  it('disables first and previous buttons on first page', () => {
    render(<Pagination {...defaultProps} />)

    expect(screen.getByRole('button', { name: 'Première page' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Page précédente' })).toBeDisabled()
  })

  it('enables next and last buttons on first page', () => {
    render(<Pagination {...defaultProps} />)

    expect(screen.getByRole('button', { name: 'Page suivante' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Dernière page' })).toBeEnabled()
  })

  it('calls onPageChange when clicking a page number', () => {
    render(<Pagination {...defaultProps} />)

    fireEvent.click(screen.getByRole('button', { name: '2' }))

    expect(defaultProps.onPageChange).toHaveBeenCalledWith(2)
  })

  it('calls onPageChange when clicking next', () => {
    render(<Pagination {...defaultProps} />)

    fireEvent.click(screen.getByRole('button', { name: 'Page suivante' }))

    expect(defaultProps.onPageChange).toHaveBeenCalledWith(2)
  })

  it('shows ellipsis for many pages', () => {
    render(<Pagination {...defaultProps} currentPage={5} />)

    expect(screen.getAllByText('...').length).toBeGreaterThan(0)
  })

  it('displays total items info when provided', () => {
    render(<Pagination {...defaultProps} totalItems={195} pageSize={20} />)

    expect(screen.getByText(/Affichage de 1 à 20 sur 195 éléments/)).toBeInTheDocument()
  })
})

describe('SimplePagination Component', () => {
  const defaultProps = {
    currentPage: 1,
    totalPages: 10,
    onPageChange: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders page indicator in French', () => {
    render(<SimplePagination {...defaultProps} />)

    expect(screen.getByText(/page 1 sur 10/i)).toBeInTheDocument()
  })

  it('disables previous button on first page', () => {
    render(<SimplePagination {...defaultProps} />)

    expect(screen.getByRole('button', { name: /précédent/i })).toBeDisabled()
  })

  it('calls onPageChange when clicking next', () => {
    render(<SimplePagination {...defaultProps} />)

    fireEvent.click(screen.getByRole('button', { name: /suivant/i }))

    expect(defaultProps.onPageChange).toHaveBeenCalledWith(2)
  })
})
