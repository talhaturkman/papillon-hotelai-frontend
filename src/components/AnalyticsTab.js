import { Chart, registerables } from 'chart.js';
import 'chartjs-adapter-date-fns';

Chart.register(...registerables);

function AnalyticsTab({ hotel, language }) {
  const [period, setPeriod] = useState('24h');
  const [chartData, setChartData] = useState([]);
  const [topQueries, setTopQueries] = useState([]);
  const [supportRequests, setSupportRequests] = useState(0);
  const [queryCount, setQueryCount] = useState(0);
  const [avgResponseTime, setAvgResponseTime] = useState(0);

  const loadAnalytics = useCallback(async () => {
    const token = localStorage.getItem('adminToken');
    if (!token) return;
    try {
      const response = await axios.get('http://localhost:5002/api/analytics', {
        headers: { Authorization: `Bearer ${token}` },
        params: { hotel, language, period }
      });
      const data = response.data;
      setChartData(data.chartData);
      setTopQueries(data.topQueries);
      setSupportRequests(data.supportRequests);
      setQueryCount(data.queryCount);
      setAvgResponseTime(data.avgResponseTime);
    } catch (error) {
      console.error("Error loading analytics:", error);
    }
  }, [hotel, language, period]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    const interval = setInterval(() => {
        loadAnalytics();
    }, 60000); 
    return () => clearInterval(interval);
  }, [loadAnalytics]);

  useEffect(() => {
    const ctx = document.getElementById('queryChart');
    // ... existing code ...
  }, [chartData]);

  return (
    // ... JSX for the component
  );
}

export default AnalyticsTab; 