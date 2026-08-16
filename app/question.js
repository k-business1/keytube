// ── Load Unmatched AI Questions into Admin Table ───────────────
function loadUnmatchedQuestions() {
  var tbody = document.getElementById('unmatchedTableBody');
  if (!tbody) return; // Exit if table doesn't exist on current page

  tbody.innerHTML = '<tr><td colspan="2" class="loading-text">Loading unmatched questions...</td></tr>';

  // Assumes 'adminToken' is stored globally or provided by auth.js
  var token = typeof adminToken !== 'undefined' ? adminToken : (localStorage.getItem('adminToken') || '');

  google.script.run
    .withSuccessHandler(function(res) {
      console.log("Raw response from backend:", res); // Debug log

      // Handle cases where the backend returns a direct array instead of an object { ok, questions }
      var questions = [];
      if (Array.isArray(res)) {
        questions = res;
      } else if (res && Array.isArray(res.questions)) {
        if (res.ok === false) {
          tbody.innerHTML = '<tr><td colspan="2" class="empty-text">Error: ' + (res.msg || 'Unauthorized') + '</td></tr>';
          return;
        }
        questions = res.questions;
      } else {
        tbody.innerHTML = '<tr><td colspan="2" class="empty-text">Error: Invalid data format returned from server.</td></tr>';
        return;
      }

      if (questions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" class="empty-text">No unmatched questions found yet. Great job! 🎉</td></tr>';
        return;
      }

      var html = '';
      questions.forEach(function(item) {
        var formattedDate = item.timestamp ? new Date(item.timestamp).toLocaleString() : 'N/A';
        var questionText = item.question || item[1] || 'Unknown question'; // Fallback if data format varies
        
        html += '<tr>' +
                  '<td style="white-space: nowrap; color: #606266;">' + formattedDate + '</td>' +
                  '<td style="color: #303133; font-weight: 500;">' + escapeHtml(questionText) + '</td>' +
                '</tr>';
      });
      tbody.innerHTML = html;
    })
    .withFailureHandler(function(err) {
      console.error(err);
      tbody.innerHTML = '<tr><td colspan="2" class="empty-text">Failed to load questions. Please try again.</td></tr>';
    })
    .getUnmatchedQuestions({ token: token });
}

// Simple security helper to prevent HTML injection in question rendering
function escapeHtml(text) {
  var map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, function(m) { return map[m]; });
}

// Automatically run when the page finishes loading
document.addEventListener('DOMContentLoaded', function() {
  loadUnmatchedQuestions();
});
