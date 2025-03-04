// src/components/Dashboard.js
import React, { useState, useEffect } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import {
  Container,
  Grid,
  Paper,
  Typography,
  CircularProgress,
  Divider,
  Button,
} from '@material-ui/core';
import RefreshIcon from '@material-ui/icons/Refresh';
import AutorenewIcon from '@material-ui/icons/Autorenew';
import axios from 'axios';
import { Pie, Bar, Line } from 'react-chartjs-2';
import { useAuth } from '../contexts/AuthContext';
import { useSnackbar } from '../contexts/SnackbarContext';

const useStyles = makeStyles((theme) => ({
  container: {
    paddingTop: theme.spacing(4),
    paddingBottom: theme.spacing(4),
  },
  paper: {
    padding: theme.spacing(3),
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
  },
  title: {
    marginBottom: theme.spacing(2),
  },
  chartContainer: {
    height: 300,
    position: 'relative',
  },
  progress: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -20,
    marginLeft: -20,
  },
  totalAmount: {
    fontSize: '2.5rem',
    fontWeight: 500,
    marginBottom: theme.spacing(1),
  },
  amountLabel: {
    color: theme.palette.text.secondary,
  },
  refreshButton: {
    marginRight: theme.spacing(1),
  },
  divider: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  actionButtons: {
    marginTop: theme.spacing(2),
    marginBottom: theme.spacing(1),
  },
}));

// Generate nice colors for charts
const generateColors = (count) => {
  const colors = [
    '#4285F4', // Google Blue
    '#EA4335', // Google Red
    '#FBBC05', // Google Yellow
    '#34A853', // Google Green
    '#FF6D00', // Orange
    '#2979FF', // Light Blue
    '#651FFF', // Deep Purple
    '#C2185B', // Pink
    '#00796B', // Teal
    '#FFA000', // Amber
  ];
  
  // If we need more colors than we have, generate them
  if (count > colors.length) {
    for (let i = colors.length; i < count; i++) {
      const r = Math.floor(Math.random() * 255);
      const g = Math.floor(Math.random() * 255);
      const b = Math.floor(Math.random() * 255);
      colors.push(`rgb(${r}, ${g}, ${b})`);
    }
  }
  
  return colors.slice(0, count);
};

function Dashboard() {
  const classes = useStyles();
  const { currentUser } = useAuth();
  const { showSnackbar } = useSnackbar();
  
  const [loading, setLoading] = useState(true);
  const [fetchingEmails, setFetchingEmails] = useState(false);
  const [dashboardData, setDashboardData] = useState({
    totalSpending: 0,
    spendingByCategory: {},
    topMerchants: {},
  });
  const [monthlyData, setMonthlyData] = useState([]);
  const [recentExpenses, setRecentExpenses] = useState([]);
  
  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      const response = await axios.get(`/api/dashboard/summary?user_id=${currentUser.id}`);
      setDashboardData(response.data);
      
      // Also fetch recent expenses
      const expensesResponse = await axios.get(`/api/expenses?user_id=${currentUser.id}&limit=5`);
      setRecentExpenses(expensesResponse.data.expenses);
      
      // Fetch monthly data for the line chart
      // This would be an endpoint that returns spending by month
      // For now, we'll create dummy data
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const dummyMonthlyData = months.map((month, index) => ({
        month,
        amount: Math.random() * 1000 + 500,
      }));
      setMonthlyData(dummyMonthlyData);
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      showSnackbar('Failed to load dashboard data', 'error');
      setLoading(false);
    }
  };
  
  // Trigger email fetching
  const fetchEmails = async () => {
    try {
      setFetchingEmails(true);
      
      await axios.post(`/api/emails/fetch?user_id=${currentUser.id}`);
      
      showSnackbar('Fetching emails in the background. Check back soon for new expenses.', 'info');
      
      setFetchingEmails(false);
    } catch (error) {
      console.error('Error fetching emails:', error);
      showSnackbar('Failed to fetch emails', 'error');
      setFetchingEmails(false);
    }
  };
  
  // Initial data load
  useEffect(() => {
    if (currentUser) {
      fetchDashboardData();
    }
  }, [currentUser]);
  
  // Prepare chart data
  const pieChartData = {
    labels: Object.keys(dashboardData.spendingByCategory),
    datasets: [
      {
        data: Object.values(dashboardData.spendingByCategory),
        backgroundColor: generateColors(Object.keys(dashboardData.spendingByCategory).length),
        borderWidth: 1,
      },
    ],
  };
  
  const barChartData = {
    labels: Object.keys(dashboardData.topMerchants),
    datasets: [
      {
        label: 'Spending ($)',
        data: Object.values(dashboardData.topMerchants),
        backgroundColor: generateColors(Object.keys(dashboardData.topMerchants).length),
        borderWidth: 1,
      },
    ],
  };
  
  const lineChartData = {
    labels: monthlyData.map((item) => item.month),
    datasets: [
      {
        label: 'Monthly Spending ($)',
        data: monthlyData.map((item) => item.amount),
        fill: false,
        borderColor: '#4285F4',
        tension: 0.1,
      },
    ],
  };
  
  return (
    <Container maxWidth="lg" className={classes.container}>
      <Grid container spacing={3}>
        {/* Total Spending Card */}
        <Grid item xs={12} md={4}>
          <Paper className={classes.paper}>
            <Typography variant="h6" className={classes.title}>
              Current Month Spending
            </Typography>
            {loading ? (
              <CircularProgress className={classes.progress} />
            ) : (
              <>
                <Typography variant="h3" className={classes.totalAmount}>
                  ${dashboardData.totalSpending.toFixed(2)}
                </Typography>
                <Typography variant="body2" className={classes.amountLabel}>
                  Total expenses this month
                </Typography>
                <div className={classes.actionButtons}>
                  <Button
                    variant="outlined"
                    color="primary"
                    startIcon={<RefreshIcon />}
                    onClick={fetchDashboardData}
                    className={classes.refreshButton}
                  >
                    Refresh
                  </Button>
                  <Button
                    variant="outlined"
                    color="secondary"
                    startIcon={<AutorenewIcon />}
                    onClick={fetchEmails}
                    disabled={fetchingEmails}
                  >
                    {fetchingEmails ? 'Fetching...' : 'Fetch Emails'}
                  </Button>
                </div>
              </>
            )}
          </Paper>
        </Grid>
        
        {/* Spending by Category */}
        <Grid item xs={12} md={8}>
          <Paper className={classes.paper}>
            <Typography variant="h6" className={classes.title}>
              Spending by Category
            </Typography>
            <div className={classes.chartContainer}>
              {loading ? (
                <CircularProgress className={classes.progress} />
              ) : (
                <Pie
                  data={pieChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'right',
                      },
                    },
                  }}
                />
              )}
            </div>
          </Paper>
        </Grid>
        
        {/* Monthly Spending Trend */}
        <Grid item xs={12}>
          <Paper className={classes.paper}>
            <Typography variant="h6" className={classes.title}>
              Monthly Spending Trend
            </Typography>
            <div className={classes.chartContainer}>
              {loading ? (
                <CircularProgress className={classes.progress} />
              ) : (
                <Line
                  data={lineChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        display: false,
                      },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                      },
                    },
                  }}
                />
              )}
            </div>
          </Paper>
        </Grid>
        
        {/* Top Merchants */}
        <Grid item xs={12} md={6}>
          <Paper className={classes.paper}>
            <Typography variant="h6" className={classes.title}>
              Top Merchants
            </Typography>
            <div className={classes.chartContainer}>
              {loading ? (
                <CircularProgress className={classes.progress} />
              ) : (
                <Bar
                  data={barChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        display: false,
                      },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                      },
                    },
                  }}
                />
              )}
            </div>
          </Paper>
        </Grid>
        
        {/* Recent Expenses */}
        <Grid item xs={12} md={6}>
          <Paper className={classes.paper}>
            <Typography variant="h6" className={classes.title}>
              Recent Expenses
            </Typography>
            {loading ? (
              <CircularProgress className={classes.progress} />
            ) : (
              <>
                {recentExpenses.length > 0 ? (
                  recentExpenses.map((expense, index) => (
                    <React.Fragment key={expense.id}>
                      <Grid container spacing={2}>
                        <Grid item xs={8}>
                          <Typography variant="body1">
                            {expense.merchant}
                          </Typography>
                          <Typography variant="body2" color="textSecondary">
                            {expense.date} • {expense.category_name}
                          </Typography>
                        </Grid>
                        <Grid item xs={4} style={{ textAlign: 'right' }}>
                          <Typography variant="body1">
                            ${expense.amount.toFixed(2)}
                          </Typography>
                        </Grid>
                      </Grid>
                      {index < recentExpenses.length - 1 && (
                        <Divider className={classes.divider} />
                      )}
                    </React.Fragment>
                  ))
                ) : (
                  <Typography variant="body1">
                    No recent expenses found.
                  </Typography>
                )}
              </>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}

export default Dashboard;