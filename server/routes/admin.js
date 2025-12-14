// server/routes/admin.js
const express = require('express');
const router = express.Router();
const { supabase } = require('../config/database');
const logger = require('../utils/logger');

// GET /admin/dashboard - Get dashboard metrics
router.get('/dashboard', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    // Get today's query count
    const { count: queryCount, error: queryError } = await supabase
      .from('conversations')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayISO);

    // Get today's complaint count
    const { count: complaintCount, error: complaintError } = await supabase
      .from('complaints')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', todayISO);

    // Get average sentiment
    const { data: sentimentData, error: sentimentError } = await supabase
      .from('complaints')
      .select('sentiment_score')
      .gte('created_at', todayISO);

    const avgSentiment = sentimentData && sentimentData.length > 0
      ? sentimentData.reduce((sum, item) => sum + (item.sentiment_score || 0), 0) / sentimentData.length
      : 0;

    // Get total users
    const { count: userCount, error: userError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    // Get active users (interacted in last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const { count: activeUserCount, error: activeError } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('last_interaction', sevenDaysAgo.toISOString());

    // Get popular routes
    const { data: popularRoutes, error: routeError } = await supabase
      .from('queries')
      .select('origin_stop_id, destination_stop_id, bus_stops!queries_origin_stop_id_fkey(name), bus_stops!queries_destination_stop_id_fkey(name)')
      .gte('created_at', todayISO)
      .limit(5);

    // Get complaint categories
    const { data: complaintCategories, error: catError } = await supabase
      .from('complaints')
      .select('category')
      .gte('created_at', todayISO);

    const categoryCounts = {};
    if (complaintCategories) {
      complaintCategories.forEach(c => {
        categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
      });
    }

    const metrics = {
      date: today.toISOString().split('T')[0],
      queries: {
        today: queryCount || 0,
        total: queryCount || 0 // Can add all-time count if needed
      },
      complaints: {
        today: complaintCount || 0,
        categories: categoryCounts,
        avg_sentiment: Math.round(avgSentiment * 100) / 100
      },
      users: {
        total: userCount || 0,
        active_7days: activeUserCount || 0
      },
      popular_routes: popularRoutes || []
    };

    res.json(metrics);

  } catch (error) {
    logger.error('Dashboard metrics error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// GET /admin/complaints - Get recent complaints
router.get('/complaints', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status || null;

    let queryBuilder = supabase
      .from('complaints')
      .select('id, complaint_text, category, sentiment_score, status, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) {
      queryBuilder = queryBuilder.eq('status', status);
    }
    const { data, error } = await queryBuilder;
    if (error) throw error;

    res.json({ complaints: data });

    } catch (error) {
    logger.error('Fetch complaints error', { error: error.message });
    res.status(500).json({ error: 'Failed to fetch complaints' });
  } 
});

// PATCH /admin/complaints/:id - Update complaint status
router.patch('/complaints/:id', async (req, res) => {
try {
const { id } = req.params;
const { status } = req.body;
const updateData = {status};
if (status === 'resolved') {
  updateData.resolved_at = new Date().toISOString();
}

const { data, error } = await supabase
  .from('complaints')
  .update(updateData)
  .eq('id', id)
  .select();

if (error) throw error;
res.json({ complaint: data[0] });
} catch (error) {
logger.error('Update complaint error', { error: error.message });
res.status(500).json({ error: 'Failed to update complaint' });
}   
});

module.exports = router;