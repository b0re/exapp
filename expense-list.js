// src/components/ExpenseList.js
import React, { useState, useEffect } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import {
  Container,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Button,
  TextField,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  CircularProgress,
  Chip,
  Toolbar,
  InputAdornment,
} from '@material-ui/core';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
} from '@material-ui/icons';
import axios from 'axios';
import { DatePicker, MuiPickersUtilsProvider } from '@material-ui/pickers';
import DateFnsUtils from '@date-io/date-fns';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';

const useStyles = makeStyles((theme) => ({
  container: {
    paddingTop: theme.spacing(4),
    paddingBottom: theme.spacing(4),
  },
  paper: {
    width: '100%',
    marginBottom: theme.spacing(2),
  },
  table: {
    minWidth: 750,
  },
  tableHead: {
    backgroundColor: theme.palette.grey[100],
  },
  visuallyHidden: {
    border: 0,
    clip: 'rect(0 0 0 0)',
    height: 1,
    margin: -1,
    overflow: 'hidden',
    padding: 0,
    position: 'absolute',
    top: 20,
    width: 1,
  },
  toolbar: {
    paddingLeft: theme.spacing(2),
    paddingRight: theme.spacing(1),
    display: 'flex',
    justifyContent: 'space-between',
  },
  title: {
    flex: '1 1 100%',
  },
  searchField: {
    marginRight: theme.spacing(2),
    width: 300,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
  },
  chip: {
    margin: theme.spacing(0.5),
  },
  formControl: {
    minWidth: 200,
    width: '100%',
    marginTop: theme.spacing(1),
    marginBottom: theme.spacing(1),
  },
  dialogActions: {
    padding: theme.spacing(2),
  },
  amountCell: {
    fontWeight: 500,
  },
  colorChip: {
    fontWeight: 500,
  },
}));

function ExpenseList() {
  const classes = useStyles();
  const { currentUser } = useAuth();
  const { showSnackbar } = useSnackbar();
  
  // State variables
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  
  // Form state for add/edit expense dialog
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogMode, setDialogMode] = useState('add'); // 'add' or 'edit'
  const [currentExpense, setCurrentExpense] = useState({
    id: null,
    date: new Date(),
    amount: '',
    merchant: '',
    description: '',
    category_id: '',
  });
  
  // Delete confirmation dialog
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  
  // Fetch expenses data
  const fetchExpenses = async () => {
    try {
      setLoading(true);
      
      // Build query parameters
      let queryParams = `user_id=${currentUser.id}`;
      
      if (filterCategory) {
        queryParams += `&category_id=${filterCategory}`;
      }
      
      const response = await axios.get(`/api/expenses?${queryParams}`);
      
      // Filter by search query if it exists
      let filteredExpenses = response.data.expenses;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        filteredExpenses = filteredExpenses.filter(
          (expense) =>
            expense.merchant.toLowerCase().includes(query) ||
            (expense.description && expense.description.toLowerCase().includes(query))
        );
      }
      
      setExpenses(filteredExpenses);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      showSnackbar('Failed to load expenses', 'error');
      setLoading(false);
    }
  };
  
  // Fetch categories
  const fetchCategories = async () => {
    try {
      const response = await axios.get(`/api/categories?user_id=${currentUser.id}`);
      setCategories(response.data.categories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      showSnackbar('Failed to load categories', 'error');
    }
  };
  
  // Initial data load
  useEffect(() => {
    if (currentUser) {
      fetchCategories();
      fetchExpenses();
    }
  }, [currentUser]);
  
  // Refetch expenses when filters change
  useEffect(() => {
    if (currentUser) {
      fetchExpenses();
    }
  }, [filterCategory, searchQuery]);
  
  // Handle pagination changes
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };
  
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };
  
  // Handle search and filter
  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
  };
  
  const handleFilterChange = (event) => {
    setFilterCategory(event.target.value);
  };
  
  const clearFilters = () => {
    setSearchQuery('');
    setFilterCategory('');
  };
  
  // Dialog handlers
  const handleOpenAddDialog = () => {
    setDialogMode('add');
    setCurrentExpense({
      id: null,
      date: new Date(),
      amount: '',
      merchant: '',
      description: '',
      category_id: '',
    });
    setOpenDialog(true);
  };
  
  const handleOpenEditDialog = (expense) => {
    setDialogMode('edit');
    setCurrentExpense({
      id: expense.id,
      date: new Date(expense.date),
      amount: expense.amount.toString(),
      merchant: expense.merchant,
      description: expense.description || '',
      category_id: expense.category_id || '',
    });
    setOpenDialog(true);
  };
  
  const handleCloseDialog = () => {
    setOpenDialog(false);
  };
  
  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setCurrentExpense({
      ...currentExpense,
      [name]: value,
    });
  };
  
  const handleDateChange = (date) => {
    setCurrentExpense({
      ...currentExpense,
      date,
    });
  };
  
  // Submit expense form
  const handleSubmitExpense = async () => {
    try {
      // Validate form
      if (!currentExpense.date || !currentExpense.amount || !currentExpense.merchant) {
        showSnackbar('Please fill in all required fields', 'error');
        return;
      }
      
      const formattedDate = currentExpense.date.toISOString().split('T')[0];
      
      if (dialogMode === 'add') {
        await axios.post('/api/expenses', {
          date: formattedDate,
          amount: parseFloat(currentExpense.amount),
          merchant: currentExpense.merchant,
          description: currentExpense.description,
          category_id: currentExpense.category_id || null,
          user_id: currentUser.id,
        });
        
        showSnackbar('Expense added successfully', 'success');
      } else {
        await axios.put(`/api/expenses/${currentExpense.id}`, {
          date: formattedDate,
          amount: parseFloat(currentExpense.amount),
          merchant: currentExpense.merchant,
          description: currentExpense.description,
          category_id: currentExpense.category_id || null,
        });
        
        showSnackbar('Expense updated successfully', 'success');
      }
      
      // Close dialog and refresh data
      handleCloseDialog();
      fetchExpenses();
    } catch (error) {
      console.error('Error saving expense:', error);
      showSnackbar('Failed to save expense', 'error');
    }
  };
  
  // Delete expense handlers
  const handleOpenDeleteDialog = (expense) => {
    setExpenseToDelete(expense);
    setOpenDeleteDialog(true);
  };
  
  const handleCloseDeleteDialog = () => {
    setOpenDeleteDialog(false);
    setExpenseToDelete(null);
  };
  
  const handleDeleteExpense = async () => {
    try {
      await axios.delete(`/api/expenses/${expenseToDelete.id}`);
      
      showSnackbar('Expense deleted successfully', 'success');
      handleCloseDeleteDialog();
      fetchExpenses();
    } catch (error) {
      console.error('Error deleting expense:', error);
      showSnackbar('Failed to delete expense', 'error');
    }
  };
  
  // Find category name by ID
  const getCategoryName = (categoryId) => {
    const category = categories.find((c) => c.id === categoryId);
    return category ? category.name : 'Uncategorized';
  };
  
  // Get category color based on name (for UI visualization)
  const getCategoryColor = (categoryName) => {
    const colors = {
      Food: '#4caf50',
      Shopping: '#2196f3',
      Transportation: '#ff9800',
      Entertainment: '#9c27b0',
      Bills: '#f44336',
      Travel: '#009688',
      Health: '#e91e63',
      Other: '#607d8b',
      Uncategorized: '#9e9e9e',
    };
    
    return colors[categoryName] || colors.Other;
  };
  
  return (
    <MuiPickersUtilsProvider utils={DateFnsUtils}>
      <Container maxWidth="lg" className={classes.container}>
        <Paper className={classes.paper}>
          <Toolbar className={classes.toolbar}>
            <Typography className={classes.title} variant="h6" id="tableTitle">
              Expenses
            </Typography>
            <div className={classes.actions}>
              <TextField
                className={classes.searchField}
                variant="outlined"
                size="small"
                placeholder="Search expenses..."
                value={searchQuery}
                onChange={handleSearchChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                  ),
                }}
              />
              <FormControl variant="outlined" size="small" style={{ minWidth: 150, marginRight: 8 }}>
                <InputLabel id="category-filter-label">Category</InputLabel>
                <Select
                  labelId="category-filter-label"
                  value={filterCategory}
                  onChange={handleFilterChange}
                  label="Category"
                >
                  <MenuItem value="">All Categories</MenuItem>
                  {categories.map((category) => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Button
                variant="outlined"
                size="small"
                onClick={clearFilters}
                disabled={!searchQuery && !filterCategory}
              >
                Clear Filters
              </Button>
              <Button
                variant="contained"
                color="primary"
                startIcon={<AddIcon />}
                onClick={handleOpenAddDialog}
                style={{ marginLeft: 16 }}
              >
                Add Expense
              </Button>
            </div>
          </Toolbar>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
              <CircularProgress />
            </div>
          ) : (
            <>
              <TableContainer>
                <Table className={classes.table} aria-labelledby="tableTitle" size="medium">
                  <TableHead className={classes.tableHead}>
                    <TableRow>
                      <TableCell>Date</TableCell>
                      <TableCell>Merchant</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>Category</TableCell>
                      <TableCell align="right">Amount</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {expenses
                      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                      .map((expense) => {
                        const categoryName = getCategoryName(expense.category_id);
                        
                        return (
                          <TableRow hover key={expense.id}>
                            <TableCell>{expense.date}</TableCell>
                            <TableCell>{expense.merchant}</TableCell>
                            <TableCell>{expense.description || '-'}</TableCell>
                            <TableCell>
                              <Chip
                                label={categoryName}
                                size="small"
                                className={classes.colorChip}
                                style={{
                                  backgroundColor: getCategoryColor(categoryName),
                                  color: 'white',
                                }}
                              />
                            </TableCell>
                            <TableCell align="right" className={classes.amountCell}>
                              ${expense.amount.toFixed(2)}
                            </TableCell>
                            <TableCell align="right">
                              <IconButton
                                aria-label="edit"
                                size="small"
                                onClick={() => handleOpenEditDialog(expense)}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                aria-label="delete"
                                size="small"
                                onClick={() => handleOpenDeleteDialog(expense)}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    {expenses.length === 0 && (
                      <TableRow style={{ height: 53 }}>
                        <TableCell colSpan={6} align="center">
                          No expenses found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                rowsPerPageOptions={[5, 10, 25]}
                component="div"
                count={expenses.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
              />
            </>
          )}
        </Paper>
      </Container>
      
      {/* Add/Edit Expense Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>
          {dialogMode === 'add' ? 'Add New Expense' : 'Edit Expense'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <DatePicker
                autoOk
                variant="inline"
                inputVariant="outlined"
                label="Date"
                format="MM/dd/yyyy"
                value={currentExpense.date}
                onChange={handleDateChange}
                fullWidth
                margin="normal"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                name="amount"
                label="Amount"
                type="number"
                value={currentExpense.amount}
                onChange={handleInputChange}
                variant="outlined"
                fullWidth
                margin="normal"
                InputProps={{
                  startAdornment: <InputAdornment position="start">$</InputAdornment>,
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                name="merchant"
                label="Merchant"
                value={currentExpense.merchant}
                onChange={handleInputChange}
                variant="outlined"
                fullWidth
                margin="normal"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                name="description"
                label="Description"
                value={currentExpense.description}
                onChange={handleInputChange}
                variant="outlined"
                fullWidth
                margin="normal"
                multiline
                rows={2}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl variant="outlined" className={classes.formControl}>
                <InputLabel id="category-label">Category</InputLabel>
                <Select
                  labelId="category-label"
                  name="category_id"
                  value={currentExpense.category_id}
                  onChange={handleInputChange}
                  label="Category"
                >
                  <MenuItem value="">
                    <em>Uncategorized</em>
                  </MenuItem>
                  {categories.map((category) => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions className={classes.dialogActions}>
          <Button onClick={handleCloseDialog} color="primary">
            Cancel
          </Button>
          <Button onClick={handleSubmitExpense} color="primary" variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
      
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={openDeleteDialog}
        onClose={handleCloseDeleteDialog}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the expense from {expenseToDelete?.merchant} for ${expenseToDelete?.amount.toFixed(2)}?
          </Typography>
        </DialogContent>
        <DialogActions className={classes.dialogActions}>
          <Button onClick={handleCloseDeleteDialog} color="primary">
            Cancel
          </Button>
          <Button onClick={handleDeleteExpense} color="secondary" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </MuiPickersUtilsProvider>
  );
}

export default ExpenseList;