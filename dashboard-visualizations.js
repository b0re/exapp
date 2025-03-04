// src/components/Dashboard/SpendingByCategory.js
import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { CircularProgress, Typography } from '@material-ui/core';
import { ResponsivePie } from '@nivo/pie';
import { useTheme } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
  chartContainer: {
    height: 300,
    position: 'relative',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  emptyContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    color: theme.palette.text.secondary,
  },
}));

function SpendingByCategory({ data, isLoading }) {
  const classes = useStyles();
  const theme = useTheme();
  
  if (isLoading) {
    return (
      <div className={classes.loadingContainer}>
        <CircularProgress />
      </div>
    );
  }
  
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className={classes.emptyContainer}>
        <Typography variant="body1">
          No category data available
        </Typography>
      </div>
    );
  }
  
  // Prepare data for Nivo Pie chart
  const chartData = Object.entries(data).map(([category, amount]) => ({
    id: category,
    label: category,
    value: amount,
  }));
  
  return (
    <div className={classes.chartContainer}>
      <ResponsivePie
        data={chartData}
        margin={{ top: 40, right: 80, bottom: 80, left: 80 }}
        innerRadius={0.5}
        padAngle={0.7}
        cornerRadius={3}
        activeOuterRadiusOffset={8}
        borderWidth={1}
        borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
        arcLinkLabelsSkipAngle={10}
        arcLinkLabelsTextColor={theme.palette.text.primary}
        arcLinkLabelsThickness={2}
        arcLinkLabelsColor={{ from: 'color' }}
        arcLabelsSkipAngle={10}
        arcLabelsTextColor={{ from: 'color', modifiers: [['darker', 2]] }}
        colors={{ scheme: 'nivo' }}
        legends={[
          {
            anchor: 'bottom',
            direction: 'row',
            justify: false,
            translateX: 0,
            translateY: 56,
            itemsSpacing: 0,
            itemWidth: 100,
            itemHeight: 18,
            itemTextColor: theme.palette.text.secondary,
            itemDirection: 'left-to-right',
            itemOpacity: 1,
            symbolSize: 18,
            symbolShape: 'circle',
            effects: [
              {
                on: 'hover',
                style: {
                  itemTextColor: theme.palette.text.primary,
                },
              },
            ],
          },
        ]}
      />
    </div>
  );
}

export default SpendingByCategory;

// src/components/Dashboard/SpendingTrend.js
import React, { useEffect, useState } from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { CircularProgress, Typography } from '@material-ui/core';
import { ResponsiveLine } from '@nivo/line';
import { useTheme } from '@material-ui/core/styles';
import apiClient from '../../api/apiClient';

const useStyles = makeStyles((theme) => ({
  chartContainer: {
    height: 300,
    position: 'relative',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  emptyContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    color: theme.palette.text.secondary,
  },
}));

function SpendingTrend({ userId, isLoading }) {
  const classes = useStyles();
  const theme = useTheme();
  const [monthlyData, setMonthlyData] = useState([]);
  const [isDataLoading, setIsDataLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (!userId) return;
    
    // Fetch monthly spending data
    const fetchMonthlyData = async () => {
      setIsDataLoading(true);
      try {
        // In a real implementation, you'd fetch this from the API
        // Here we're simulating by creating data for the last 12 months
        const now = new Date();
        const months = [];
        const data = [];
        
        for (let i = 11; i >= 0; i--) {
          const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthName = date.toLocaleString('default', { month: 'short' });
          const year = date.getFullYear();
          months.push(`${monthName} ${year}`);
          
          // Simulate monthly spending data (random between 500 and 3000)
          data.push(Math.floor(Math.random() * 2500) + 500);
        }
        
        setMonthlyData([
          {
            id: 'monthly-spending',
            color: theme.palette.primary.main,
            data: months.map((month, index) => ({
              x: month,
              y: data[index],
            })),
          },
        ]);
        setIsDataLoading(false);
      } catch (err) {
        console.error('Error fetching monthly data:', err);
        setError(err);
        setIsDataLoading(false);
      }
    };
    
    fetchMonthlyData();
  }, [userId, theme.palette.primary.main]);
  
  if (isLoading || isDataLoading) {
    return (
      <div className={classes.loadingContainer}>
        <CircularProgress />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className={classes.emptyContainer}>
        <Typography variant="body1" color="error">
          Error loading spending trend data
        </Typography>
      </div>
    );
  }
  
  if (!monthlyData || monthlyData.length === 0) {
    return (
      <div className={classes.emptyContainer}>
        <Typography variant="body1">
          No spending trend data available
        </Typography>
      </div>
    );
  }
  
  return (
    <div className={classes.chartContainer}>
      <ResponsiveLine
        data={monthlyData}
        margin={{ top: 50, right: 110, bottom: 50, left: 60 }}
        xScale={{ type: 'point' }}
        yScale={{
          type: 'linear',
          min: 'auto',
          max: 'auto',
          stacked: false,
          reverse: false,
        }}
        yFormat=" >-.2f"
        axisTop={null}
        axisRight={null}
        axisBottom={{
          tickSize: 5,
          tickPadding: 5,
          tickRotation: -45,
          legend: 'Month',
          legendOffset: 40,
          legendPosition: 'middle',
        }}
        axisLeft={{
          tickSize: 5,
          tickPadding: 5,
          tickRotation: 0,
          legend: 'Amount ($)',
          legendOffset: -40,
          legendPosition: 'middle',
        }}
        colors={{ scheme: 'nivo' }}
        pointSize={10}
        pointColor={{ theme: 'background' }}
        pointBorderWidth={2}
        pointBorderColor={{ from: 'serieColor' }}
        pointLabelYOffset={-12}
        useMesh={true}
        legends={[
          {
            anchor: 'bottom-right',
            direction: 'column',
            justify: false,
            translateX: 100,
            translateY: 0,
            itemsSpacing: 0,
            itemDirection: 'left-to-right',
            itemWidth: 80,
            itemHeight: 20,
            itemOpacity: 0.75,
            symbolSize: 12,
            symbolShape: 'circle',
            symbolBorderColor: 'rgba(0, 0, 0, .5)',
            effects: [
              {
                on: 'hover',
                style: {
                  itemBackground: 'rgba(0, 0, 0, .03)',
                  itemOpacity: 1,
                },
              },
            ],
          },
        ]}
      />
    </div>
  );
}

export default SpendingTrend;

// src/components/Dashboard/TopMerchants.js
import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import { CircularProgress, Typography } from '@material-ui/core';
import { ResponsiveBar } from '@nivo/bar';
import { useTheme } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
  chartContainer: {
    height: 300,
    position: 'relative',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  emptyContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    color: theme.palette.text.secondary,
  },
}));

function TopMerchants({ data, isLoading }) {
  const classes = useStyles();
  const theme = useTheme();
  
  if (isLoading) {
    return (
      <div className={classes.loadingContainer}>
        <CircularProgress />
      </div>
    );
  }
  
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className={classes.emptyContainer}>
        <Typography variant="body1">
          No merchant data available
        </Typography>
      </div>
    );
  }
  
  // Prepare data for Nivo Bar chart
  const chartData = Object.entries(data).map(([merchant, amount]) => ({
    merchant: merchant.length > 12 ? merchant.substring(0, 12) + '...' : merchant,
    amount: amount,
  }));
  
  return (
    <div className={classes.chartContainer}>
      <ResponsiveBar
        data={chartData}
        keys={['amount']}
        indexBy="merchant"
        margin={{ top: 50, right: 60, bottom: 50, left: 60 }}
        padding={0.3}
        valueScale={{ type: 'linear' }}
        indexScale={{ type: 'band', round: true }}
        colors={{ scheme: 'nivo' }}
        axisTop={null}
        axisRight={null}
        axisBottom={{
          tickSize: 5,
          tickPadding: 5,
          tickRotation: -45,
          legend: 'Merchant',
          legendPosition: 'middle',
          legendOffset: 40,
        }}
        axisLeft={{
          tickSize: 5,
          tickPadding: 5,
          tickRotation: 0,
          legend: 'Amount ($)',
          legendPosition: 'middle',
          legendOffset: -40,
        }}
        labelSkipWidth={12}
        labelSkipHeight={12}
        labelTextColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
        animate={true}
        motionStiffness={90}
        motionDamping={15}
      />
    </div>
  );
}

export default TopMerchants;

// src/components/Dashboard/RecentExpenses.js
import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import {
  CircularProgress,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Chip,
} from '@material-ui/core';
import { useExpenses } from '../../api/queries';

const useStyles = makeStyles((theme) => ({
  root: {
    width: '100%',
    height: 300,
    overflow: 'auto',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  emptyContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    color: theme.palette.text.secondary,
  },
  amount: {
    fontWeight: 500,
  },
  chip: {
    marginLeft: theme.spacing(1),
    height: 24,
  },
}));

function RecentExpenses({ userId, isLoading }) {
  const classes = useStyles();
  
  // Fetch recent expenses (limit to 5)
  const { data: expenses, isLoading: isExpensesLoading, error } = useExpenses(userId, { limit: 5 });
  
  if (isLoading || isExpensesLoading) {
    return (
      <div className={classes.loadingContainer}>
        <CircularProgress />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className={classes.emptyContainer}>
        <Typography variant="body1" color="error">
          Error loading recent expenses
        </Typography>
      </div>
    );
  }
  
  if (!expenses || expenses.length === 0) {
    return (
      <div className={classes.emptyContainer}>
        <Typography variant="body1">
          No recent expenses found
        </Typography>
      </div>
    );
  }
  
  // Category color mapping
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
    <div className={classes.root}>
      <List>
        {expenses.map((expense, index) => (
          <React.Fragment key={expense.id}>
            <ListItem>
              <ListItemText
                primary={expense.merchant}
                secondary={
                  <React.Fragment>
                    {new Date(expense.date).toLocaleDateString()}
                    <Chip
                      label={expense.category?.name || 'Uncategorized'}
                      size="small"
                      className={classes.chip}
                      style={{
                        backgroundColor: getCategoryColor(expense.category?.name || 'Uncategorized'),
                        color: 'white',
                      }}
                    />
                  </React.Fragment>
                }
              />
              <ListItemSecondaryAction>
                <Typography variant="body1" className={classes.amount}>
                  ${expense.amount.toFixed(2)}
                </Typography>
              </ListItemSecondaryAction>
            </ListItem>
            {index < expenses.length - 1 && <Divider />}
          </React.Fragment>
        ))}
      </List>
    </div>
  );
}

export default RecentExpenses;

// src/components/Dashboard/FuturePredictions.js
import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import {
  CircularProgress,
  Typography,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@material-ui/core';
import { ResponsiveLine } from '@nivo/line';
import { useTheme } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
  chartContainer: {
    height: 400,
    position: 'relative',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  emptyContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
    color: theme.palette.text.secondary,
  },
  paper: {
    padding: theme.spacing(2),
    marginTop: theme.spacing(2),
  },
  tableContainer: {
    maxHeight: 300,
  },
  modelInfo: {
    margin: theme.spacing(2, 0),
  },
}));

function FuturePredictions({ data, isLoading }) {
  const classes = useStyles();
  const theme = useTheme();
  
  if (isLoading) {
    return (
      <div className={classes.loadingContainer}>
        <CircularProgress />
      </div>
    );
  }
  
  if (!data || !data.predictions || data.predictions.length === 0) {
    return (
      <div className={classes.emptyContainer}>
        <Typography variant="body1">
          Not enough data to generate expense predictions.
        </Typography>
        <Typography variant="body2" color="textSecondary" style={{ marginTop: 8 }}>
          Continue adding expenses to enable this feature.
        </Typography>
      </div>
    );
  }
  
  // Prepare data for Nivo Line chart
  const chartData = [
    {
      id: 'predictions',
      color: theme.palette.primary.main,
      data: data.predictions.map((pred) => ({
        x: pred.date,
        y: pred.amount,
      })),
    },
    {
      id: 'lower-bound',
      color: theme.palette.grey[400],
      data: data.predictions.map((pred) => ({
        x: pred.date,
        y: pred.lower_bound,
      })),
    },
    {
      id: 'upper-bound',
      color: theme.palette.grey[400],
      data: data.predictions.map((pred) => ({
        x: pred.date,
        y: pred.upper_bound,
      })),
    },
  ];
  
  return (
    <div>
      <Typography variant="body1" paragraph>
        Based on your spending patterns, here's a prediction of your future expenses.
        The shaded area represents the prediction confidence interval.
      </Typography>
      
      <div className={classes.chartContainer}>
        <ResponsiveLine
          data={chartData}
          margin={{ top: 50, right: 110, bottom: 50, left: 60 }}
          xScale={{ type: 'point' }}
          yScale={{
            type: 'linear',
            min: 'auto',
            max: 'auto',
            stacked: false,
            reverse: false,
          }}
          yFormat=" >-.2f"
          curve="cardinal"
          axisTop={null}
          axisRight={null}
          axisBottom={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: -45,
            legend: 'Date',
            legendOffset: 36,
            legendPosition: 'middle',
          }}
          axisLeft={{
            tickSize: 5,
            tickPadding: 5,
            tickRotation: 0,
            legend: 'Amount ($)',
            legendOffset: -40,
            legendPosition: 'middle',
          }}
          enableSlices="x"
          colors={{ scheme: 'category10' }}
          lineWidth={3}
          pointSize={10}
          pointColor={{ theme: 'background' }}
          pointBorderWidth={2}
          pointBorderColor={{ from: 'serieColor' }}
          pointLabelYOffset={-12}
          useMesh={true}
          legends={[
            {
              anchor: 'bottom-right',
              direction: 'column',
              justify: false,
              translateX: 100,
              translateY: 0,
              itemsSpacing: 0,
              itemDirection: 'left-to-right',
              itemWidth: 80,
              itemHeight: 20,
              itemOpacity: 0.75,
              symbolSize: 12,
              symbolShape: 'circle',
              symbolBorderColor: 'rgba(0, 0, 0, .5)',
              effects: [
                {
                  on: 'hover',
                  style: {
                    itemBackground: 'rgba(0, 0, 0, .03)',
                    itemOpacity: 1,
                  },
                },
              ],
            },
          ]}
        />
      </div>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper className={classes.paper}>
            <Typography variant="h6" gutterBottom>
              Upcoming Expenses
            </Typography>
            <TableContainer className={classes.tableContainer}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell align="right">Amount</TableCell>
                    <TableCell align="right">Range</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.predictions.slice(0, 7).map((prediction) => (
                    <TableRow key={prediction.date}>
                      <TableCell>{prediction.date}</TableCell>
                      <TableCell align="right">${prediction.amount.toFixed(2)}</TableCell>
                      <TableCell align="right">
                        ${prediction.lower_bound.toFixed(2)} - ${prediction.upper_bound.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Paper className={classes.paper}>
            <Typography variant="h6" gutterBottom>
              Model Information
            </Typography>
            <Typography variant="body2" className={classes.modelInfo}>
              This prediction is based on your historical spending patterns using a time-series 
              forecasting model. The model analyzed {data.model_info.trained_on} transactions to
              generate these predictions.
            </Typography>
            <Typography variant="body2">
              Please note that these are estimates and actual expenses may vary based on your
              spending behavior. The prediction becomes more accurate as you add more expenses.
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </div>
  );
}

export default FuturePredictions;

// src/components/Dashboard/BudgetRecommendations.js
import React from 'react';
import { makeStyles } from '@material-ui/core/styles';
import {
  CircularProgress,
  Typography,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
  Tooltip,
  Box,
} from '@material-ui/core';
import InfoIcon from '@material-ui/icons/Info';

const useStyles = makeStyles((theme) => ({
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: 400,
  },
  emptyContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: 400,
    color: theme.palette.text.secondary,
  },
  paper: {
    padding: theme.spacing(2),
    marginTop: theme.spacing(2),
  },
  tableContainer: {
    maxHeight: 400,
  },
  progressContainer: {
    display: 'flex',
    alignItems: 'center',
    width: '100%',
  },
  progressBar: {
    flexGrow: 1,
    marginRight: theme.spacing(1),
  },
  infoIcon: {
    fontSize: '1rem',
    color: theme.palette.text.secondary,
    marginLeft: theme.spacing(1),
    cursor: 'pointer',
  },
  totalAmount: {
    fontSize: '2rem',
    fontWeight: 500,
    marginBottom: theme.spacing(1),
  },
}));

function BudgetRecommendations({ data, isLoading }) {
  const classes = useStyles();
  
  if (isLoading) {
    return (
      <div className={classes.loadingContainer}>
        <CircularProgress />
      </div>
    );
  }
  
  if (!data || !data.recommendations || data.recommendations.length === 0) {
    return (
      <div className={classes.emptyContainer}>
        <Typography variant="body1">
          Not enough data to generate budget recommendations.
        </Typography>
        <Typography variant="body2" color="textSecondary" style={{ marginTop: 8 }}>
          Continue adding expenses to enable this feature.
        </Typography>
      </div>
    );
  }
  
  return (
    <div>
      <Typography variant="body1" paragraph>
        Based on your spending patterns and those of similar users, we've created
        personalized budget recommendations to help you manage your finances.
      </Typography>
      
      <Box textAlign="center" mb={4}>
        <Typography variant="h6" gutterBottom>
          Predicted Monthly Expense
        </Typography>
        <Typography variant="h3" className={classes.totalAmount}>
          ${data.predicted_monthly_expense.toFixed(2)}
        </Typography>
      </Box>
      
      <TableContainer className={classes.tableContainer}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell>Category</TableCell>
              <TableCell>Current</TableCell>
              <TableCell>Recommended</TableCell>
              <TableCell>Budget</TableCell>
              <TableCell>% of Total</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.recommendations.map((recommendation) => (
              <TableRow key={recommendation.category}>
                <TableCell>
                  {recommendation.category}
                  <Tooltip title={recommendation.reason}>
                    <InfoIcon className={classes.infoIcon} />
                  </Tooltip>
                </TableCell>
                <TableCell>{recommendation.current_percentage.toFixed(1)}%</TableCell>
                <TableCell>{recommendation.recommended_percentage.toFixed(1)}%</TableCell>
                <TableCell>${recommendation.recommended_budget.toFixed(2)}</TableCell>
                <TableCell>
                  <div className={classes.progressContainer}>
                    <LinearProgress
                      variant="determinate"
                      value={recommendation.recommended_percentage}
                      className={classes.progressBar}
                      color={
                        recommendation.current_percentage > recommendation.recommended_percentage
                          ? 'secondary'
                          : 'primary'
                      }
                    />
                    <Typography variant="body2">
                      {recommendation.recommended_percentage.toFixed(0)}%
                    </Typography>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      
      <Paper className={classes.paper}>
        <Typography variant="h6" gutterBottom>
          Budget Notes
        </Typography>
        <Typography variant="body2" paragraph>
          These recommendations are based on your spending patterns, similar users' behaviors,
          and general budgeting guidelines. Categories where you spend more than recommended
          are highlighted in red.
        </Typography>
        <Typography variant="body2">
          Remember that a budget is a personal tool - adjust these recommendations to match
          your specific financial goals and living situation. The AI will continue to refine
          these recommendations as you add more expense data.
        </Typography>
      </Paper>
    </div>
  );
}

export default BudgetRecommendations;