$(document).ready(function () {
  $("#myButton").on("click", function () {
    $("#message").text("Button clicked! jQuery is working.");
  });

  // Initialize the unified telemetry chart safely to prevent library loading errors from crashing the whole app
  let telemetryChart = null;
  let chartData = [[], [], [], []];
  try {
    if (typeof createTelemetryChart === 'function') {
      telemetryChart = createTelemetryChart('telemetryChart');
    } else {
      throw new Error('createTelemetryChart is not defined. uPlot load may have failed.');
    }
  } catch (err) {
    console.error('Failed to initialize telemetry chart:', err);
    // Hide the history card if uPlot cannot load so other cards render fine
    $('#historyCard').hide();
    // Hide the toggle button for history chart as well
    $('#toggleHistoryCard').hide();
    if (window.onerror) {
      window.onerror('Telemetry Chart disabled: ' + err.message, 'app.js', 7);
    }
  }

  // Cache DOM element queries to improve performance and minimize DOM lookup overhead
  const $historyCard = $('#historyCard');
  const $processCard = $('#processCard');
  const $pm2Card = $('#pm2Card');
  const $dockerCard = $('#dockerCard');
  const $powerCard = $('#powerCard');
  const $toggleHistoryCard = $('#toggleHistoryCard');
  const $toggleProcessCard = $('#toggleProcessCard');
  const $togglePM2Card = $('#togglePM2Card');
  const $toggleDockerCard = $('#toggleDockerCard');
  const $togglePowerCard = $('#togglePowerCard');
  const $cpuValue = $('#cpuValue');
  const $ramValue = $('#ramValue');
  const $tempValue = $('#tempValue');
  const $processCardTitle = $('#processCardTitle');
  const $processMetricHeader = $('#processMetricHeader');
  const $processTableBody = $('#processTableBody');
  const $pm2TableBody = $('#pm2TableBody');
  const $dockerContainersTableBody = $('#dockerContainersTableBody');
  const $dockerImagesTableBody = $('#dockerImagesTableBody');
  const $dockerContainersView = $('#dockerContainersView');
  const $dockerImagesView = $('#dockerImagesView');
  const $dockerRunWrapper = $('#dockerRunWrapper');
  const $powerToday = $('#powerToday');
  const $powerYesterday = $('#powerYesterday');
  const $powerThisMonth = $('#powerThisMonth');
  const $powerLastMonth = $('#powerLastMonth');
  const $powerTodayAvg = $('#powerTodayAvg');
  const $powerYesterdayAvg = $('#powerYesterdayAvg');
  const $powerProgressBar = $('#powerProgressBar');
  const $powerThresholdText = $('#powerThresholdText');
  const $powerThresholdDay = $('#powerThresholdDay');
  const $powerLastUpdated = $('#powerLastUpdated');
  const $powerStatusBadge = $('#powerStatusBadge');
  const $powerRefreshBtn = $('#powerRefreshBtn');
  const $terminalModal = $('#terminalModal');
  const $terminalInput = $('#terminalInput');
  const $terminalConsole = $('#terminalConsole');
  const $runTerminalBtn = $('#runTerminalBtn');
  const $runTerminalText = $('#runTerminalText');

  // Load visibility settings from localStorage
  let historyCardVisible = localStorage.getItem('history_card_visible') !== 'false';
  let processCardVisible = localStorage.getItem('process_card_visible') !== 'false';
  let pm2CardVisible = localStorage.getItem('pm2_card_visible') !== 'false';
  let dockerCardVisible = localStorage.getItem('docker_card_visible') !== 'false';
  let powerCardVisible = localStorage.getItem('power_card_visible') !== 'false';
  let dockerViewMode = localStorage.getItem('docker_view_mode') || 'containers';
 
  // Apply initial visibility states on load
  const activeClass = 'text-indigo-400 hover:text-indigo-300 bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.08]';
  const inactiveClass = 'text-gray-500 hover:text-gray-400 bg-white/[0.01] hover:bg-white/[0.03] border-white/[0.03]';

  if (!historyCardVisible) {
    $historyCard.hide();
    $toggleHistoryCard.removeClass(activeClass).addClass(inactiveClass);
  }
  if (!processCardVisible) {
    $processCard.hide();
    $toggleProcessCard.removeClass(activeClass).addClass(inactiveClass);
  }
  if (!pm2CardVisible) {
    $pm2Card.hide();
    $togglePM2Card.removeClass(activeClass).addClass(inactiveClass);
  }
  if (!dockerCardVisible) {
    $dockerCard.hide();
    $toggleDockerCard.removeClass(activeClass).addClass(inactiveClass);
  }
  if (!powerCardVisible) {
    $powerCard.hide();
    $togglePowerCard.removeClass(activeClass).addClass(inactiveClass);
  }

  // Header Toggles: Show/Hide Cards
  $toggleHistoryCard.on('click', function () {
    const isVisible = $historyCard.is(':visible');
    if (isVisible) {
      $historyCard.slideUp(200);
      $(this).removeClass(activeClass).addClass(inactiveClass);
      localStorage.setItem('history_card_visible', 'false');
    } else {
      $historyCard.slideDown(200, function () {
        // Draw the latest data when card becomes visible
        if (telemetryChart && chartData) {
          telemetryChart.setData(chartData);
        }
        // Resize uPlot chart to fit its container after sliding down
        const $container = $('#chartContainer');
        if ($container.length && telemetryChart) {
          telemetryChart.setSize({
            width: $container[0].clientWidth,
            height: Math.max($container[0].clientHeight - 50, 150)
          });
        }
      });
      $(this).addClass(activeClass).removeClass(inactiveClass);
      localStorage.setItem('history_card_visible', 'true');
    }
  });

  $toggleProcessCard.on('click', function () {
    const isVisible = $processCard.is(':visible');
    if (isVisible) {
      $processCard.slideUp(200);
      $(this).removeClass(activeClass).addClass(inactiveClass);
      localStorage.setItem('process_card_visible', 'false');
    } else {
      $processCard.slideDown(200, function () {
        updateProcessTable();
      });
      $(this).addClass(activeClass).removeClass(inactiveClass);
      localStorage.setItem('process_card_visible', 'true');
    }
  });

  $togglePM2Card.on('click', function () {
    const isVisible = $pm2Card.is(':visible');
    if (isVisible) {
      $pm2Card.slideUp(200);
      $(this).removeClass(activeClass).addClass(inactiveClass);
      localStorage.setItem('pm2_card_visible', 'false');
    } else {
      $pm2Card.slideDown(200, function () {
        fetchPM2List();
      });
      $(this).addClass(activeClass).removeClass(inactiveClass);
      localStorage.setItem('pm2_card_visible', 'true');
    }
  });

  $toggleDockerCard.on('click', function () {
    const isVisible = $dockerCard.is(':visible');
    if (isVisible) {
      $dockerCard.slideUp(200);
      $(this).removeClass(activeClass).addClass(inactiveClass);
      localStorage.setItem('docker_card_visible', 'false');
    } else {
      $dockerCard.slideDown(200, function () {
        fetchDockerData();
      });
      $(this).addClass(activeClass).removeClass(inactiveClass);
      localStorage.setItem('docker_card_visible', 'true');
    }
  });
 
  $togglePowerCard.on('click', function () {
    const isVisible = $powerCard.is(':visible');
    if (isVisible) {
      $powerCard.slideUp(200);
      $(this).removeClass(activeClass).addClass(inactiveClass);
      localStorage.setItem('power_card_visible', 'false');
    } else {
      $powerCard.slideDown(200, function () {
        fetchPowerConsumption();
      });
      $(this).addClass(activeClass).removeClass(inactiveClass);
      localStorage.setItem('power_card_visible', 'true');
    }
  });

  let activeRange = localStorage.getItem('active_range') || '1h';
  let latestRAMProcesses = [];
  let latestCPUProcesses = [];
  let processViewMode = localStorage.getItem('process_view_mode') || 'ram'; // 'ram' or 'cpu'

  // Apply initial activeRange styles on load
  const activeRangeBtnClass = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.15)]';
  const inactiveRangeBtnClass = 'text-gray-400 hover:text-white border-transparent';

  $('.range-btn').removeClass(activeRangeBtnClass).addClass(inactiveRangeBtnClass);
  $(`.range-btn[data-range="${activeRange}"]`).addClass(activeRangeBtnClass).removeClass(inactiveRangeBtnClass);

  // Apply initial processViewMode styles & titles on load
  $('.process-btn').removeClass(activeRangeBtnClass).addClass(inactiveRangeBtnClass);
  $(`.process-btn[data-mode="${processViewMode}"]`).addClass(activeRangeBtnClass).removeClass(inactiveRangeBtnClass);
  if (processViewMode === 'ram') {
    $processCardTitle.text('Top RAM Consuming Processes');
    $processMetricHeader.text('Memory (%)');
  } else {
    $processCardTitle.text('Top CPU Consuming Processes');
    $processMetricHeader.text('CPU (%)');
  }

  // Process View Mode Switch Handler
  $('.process-btn').on('click', function () {
    const mode = $(this).data('mode');
    if (mode === processViewMode) return;

    processViewMode = mode;
    localStorage.setItem('process_view_mode', processViewMode);
    $('.process-btn').removeClass(activeRangeBtnClass).addClass(inactiveRangeBtnClass);
    $(this).addClass(activeRangeBtnClass).removeClass(inactiveRangeBtnClass);

    // Update title and table headers
    if (processViewMode === 'ram') {
      $processCardTitle.text('Top RAM Consuming Processes');
      $processMetricHeader.text('Memory (%)');
    } else {
      $processCardTitle.text('Top CPU Consuming Processes');
      $processMetricHeader.text('CPU (%)');
    }

    updateProcessTable();
  });

  // Update Process Table using a single DOM write
  function updateProcessTable() {
    if (!$processCard.is(':visible')) return;

    const processes = processViewMode === 'ram' ? latestRAMProcesses : latestCPUProcesses;
    let html = '';

    processes.forEach(proc => {
      let valStr = '';
      if (processViewMode === 'ram') {
        const mb = proc.ramMb ? proc.ramMb : 0;
        valStr = `${proc.mem.toFixed(2)}% (${mb.toFixed(1)} MB)`;
      } else {
        valStr = `${proc.cpu.toFixed(2)}%`;
      }

      html += `
        <tr class="group hover:bg-gray-800/30 transition-colors">
          <td class="px-2 sm:px-4 py-1.5 sm:py-2 font-mono text-gray-400">${proc.pid}</td>
          <td class="px-2 sm:px-4 py-1.5 sm:py-2">
            <div class="flex items-center">
              <span class="truncate pr-2">${proc.name}</span>
              <button class="copy-name-btn text-gray-500 hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-all active:scale-95 flex-shrink-0" data-name="${proc.name}" title="Copy Process Name">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                </svg>
              </button>
            </div>
          </td>
          <td class="px-2 sm:px-4 py-1.5 sm:py-2 text-right font-semibold text-gray-100">${valStr}</td>
        </tr>
      `;
    });

    $processTableBody.html(html);
  }

  // Handle process name copy to clipboard
  $(document).on('click', '.copy-name-btn', function (e) {
    e.preventDefault();
    const name = $(this).data('name');
    const $btn = $(this);

    const copyFn = () => {
      if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(name);
      }
      // Fallback for non-secure contexts
      return new Promise((resolve, reject) => {
        try {
          const ta = document.createElement('textarea');
          ta.value = name;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          const ok = document.execCommand('copy');
          document.body.removeChild(ta);
          ok ? resolve() : reject(new Error('execCommand copy failed'));
        } catch (err) {
          reject(err);
        }
      });
    };

    copyFn().then(() => {
      // Temporary success state indicator
      const $originalSvg = $btn.html();
      $btn.addClass('text-green-400').removeClass('text-gray-500 hover:text-indigo-400');
      // Show checkmark icon
      $btn.html(`
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path>
        </svg>
      `);

      setTimeout(() => {
        $btn.removeClass('text-green-400').addClass('text-gray-500 hover:text-indigo-400');
        $btn.html($originalSvg);
      }, 1500);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  });

  const getLimitForRange = (range) => {
    switch (range) {
      case '15m': return 90;   // 15 min * 6 points/min
      case '30m': return 180;  // 30 min * 6 points/min
      case '1h': return 360;   // 60 min * 6 points/min
      case '4h': return 1440;  // 240 min * 6 points/min
      case '24h': return 8640; // 1440 min * 6 points/min
      default: return 360;
    }
  };

  // Range selector click handlers
  $('.range-btn').on('click', function () {
    const range = $(this).data('range');
    if (range === activeRange) return;

    activeRange = range;
    localStorage.setItem('active_range', activeRange);
    $('.range-btn').removeClass(activeRangeBtnClass).addClass(inactiveRangeBtnClass);
    $(this).addClass(activeRangeBtnClass).removeClass(inactiveRangeBtnClass);

    // Reset local data cache
    chartData = [[], [], [], []];
    if ($historyCard.is(':visible') && telemetryChart) {
      telemetryChart.setData(chartData);
    }

    // Request new history from server
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: 'get_history', range: activeRange }));
    }
  });

  // WebSocket for real-time telemetry streaming - dynamically handles secure wss:// protocol
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws`);

  ws.onopen = () => {
    // If the saved activeRange is not the server default 1h, request the correct range on startup
    if (activeRange !== '1h') {
      ws.send(JSON.stringify({ action: 'get_history', range: activeRange }));
    }
  };

  ws.onmessage = event => {
    try {
      const message = JSON.parse(event.data);

      if (message.type === 'history') {
        const xVal = [];
        const cpuY = [];
        const ramY = [];
        const tempY = [];

        message.data.forEach(item => {
          xVal.push(item.timestamp / 1000);
          cpuY.push(item.cpu);
          ramY.push(item.mem);
          tempY.push(item.temp);
        });

        chartData = [xVal, cpuY, ramY, tempY];

        if ($historyCard.is(':visible') && telemetryChart) {
          telemetryChart.setData(chartData);
        }

        // Update KPI displays with latest historical values
        if (message.data.length > 0) {
          const last = message.data[message.data.length - 1];
          $cpuValue.text(last.cpu.toFixed(2));
          $tempValue.text(last.temp.toFixed(2));
          if (last.memUsed && last.memTotal) {
            $ramValue.text(`${last.memUsed} MB / ${last.memTotal} MB`);
          } else {
            $ramValue.text(last.mem.toFixed(2) + '%');
          }
        }
      } else if (message.type === 'realtime') {
        const data = message.data;
        const timeSec = Date.now() / 1000;
        const limit = getLimitForRange(activeRange);

        // Update KPI metric displays
        $cpuValue.text(parseFloat(data.cpu).toFixed(2));
        $tempValue.text(parseFloat(data.temp).toFixed(2));
        if (data.memUsed && data.memTotal) {
          $ramValue.text(`${data.memUsed} MB / ${data.memTotal} MB`);
        } else {
          $ramValue.text(parseFloat(data.mem).toFixed(2) + '%');
        }

        // Update local chartData cache with in-place mutations (highly memory-efficient)
        if (!chartData[0]) chartData[0] = [];
        if (!chartData[1]) chartData[1] = [];
        if (!chartData[2]) chartData[2] = [];
        if (!chartData[3]) chartData[3] = [];

        chartData[0].push(timeSec);
        chartData[1].push(data.cpu);
        chartData[2].push(data.mem);
        chartData[3].push(data.temp);

        while (chartData[0].length > limit) {
          chartData[0].shift();
          chartData[1].shift();
          chartData[2].shift();
          chartData[3].shift();
        }

        // Only redraw the canvas if the history card is expanded/visible
        if ($historyCard.is(':visible') && telemetryChart) {
          telemetryChart.setData(chartData);
        }

        // Update Process Table (only updates DOM if visible)
        latestRAMProcesses = data.topProcesses || [];
        latestCPUProcesses = data.topCPUProcesses || [];
        updateProcessTable();
      }
    } catch (err) {
      console.error('Error processing WebSocket message:', err);
    }
  };

  ws.onclose = () => {
    if (window.onerror) {
      window.onerror('WebSocket connection closed.', window.location.href, 0, 0);
    }
  };

  ws.onerror = error => {
    console.error('WebSocket error:', error);
    if (window.onerror) {
      window.onerror('WebSocket connection failed. Verify host and network.', window.location.href, 0, 0);
    }
  };

  // Modal Interactions: Gateway Shell Terminal
  const openTerminalModal = () => {
    $terminalModal.removeClass('hidden');
    // Force reflow
    $terminalModal[0].offsetHeight;
    $terminalModal.removeClass('opacity-0').find('> div').removeClass('scale-95');
    setTimeout(() => {
      $terminalInput.focus();
    }, 100);
  };

  const closeTerminalModal = () => {
    $terminalModal.addClass('opacity-0').find('> div').addClass('scale-95');
    setTimeout(() => {
      $terminalModal.addClass('hidden');
    }, 300);
  };

  $('#showCmdlineBtn').on('click', function (e) {
    e.preventDefault();
    openTerminalModal();
  });

  $('#closeTerminalBtn, #terminalModal').on('click', function (e) {
    if (e.target === this) {
      closeTerminalModal();
    }
  });

  // Execute terminal command function
  const runTerminalCommand = () => {
    const command = $terminalInput.val().trim();
    if (!command) return;

    // UI state loading
    $terminalInput.prop('disabled', true);
    $runTerminalBtn.prop('disabled', true).addClass('opacity-60');
    $runTerminalText.text('Running...');

    // Append the command itself
    $terminalConsole.append(`<div class="text-indigo-400 font-semibold mt-2">$ ${command}</div>`);
    $terminalConsole.scrollTop($terminalConsole[0].scrollHeight);

    // Call POST API
    $.ajax({
      url: '/api/run',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ command: command }),
      success: function (data) {
        let outputEscaped = $('<div/>').text(data.output).html();
        if (data.status !== 0) {
          $terminalConsole.append(`<pre class="text-rose-400 mt-1 whitespace-pre-wrap">${outputEscaped || 'Process exited with non-zero status (' + data.status + ')'}</pre>`);
        } else {
          $terminalConsole.append(`<pre class="text-green-300 mt-1 whitespace-pre-wrap">${outputEscaped || '(no output)'}</pre>`);
        }
      },
      error: function (xhr) {
        let errText = 'Server error or timeout';
        if (xhr.responseJSON && xhr.responseJSON.output) {
          errText = xhr.responseJSON.output;
        }
        $terminalConsole.append(`<pre class="text-rose-500 mt-1 whitespace-pre-wrap">Error: ${errText}</pre>`);
      },
      complete: function () {
        // Restore elements
        $terminalInput.prop('disabled', false).val('').focus();
        $runTerminalBtn.prop('disabled', false).removeClass('opacity-60');
        $runTerminalText.text('Execute');
        $terminalConsole.scrollTop($terminalConsole[0].scrollHeight);
      }
    });
  };

  $runTerminalBtn.on('click', function (e) {
    e.preventDefault();
    runTerminalCommand();
  });

  $terminalInput.on('keypress', function (e) {
    if (e.which === 13) { // Enter key
      e.preventDefault();
      runTerminalCommand();
    }
  });

  // PM2 Process Manager Logic
  const fetchPM2List = () => {
    if (!$pm2Card.is(':visible')) return;

    $.getJSON('/api/pm2/list', function (data) {
      if (!data || data.length === 0) {
        $pm2TableBody.html('<tr><td colspan="7" class="px-4 py-8 text-center text-gray-500 font-medium">No PM2 processes running.</td></tr>');
        return;
      }

      let html = '';
      data.forEach(proc => {
        const pmId = proc.pm_id;
        const name = proc.name;
        const status = proc.pm2_env ? proc.pm2_env.status : 'unknown';
        const restarts = proc.pm2_env ? proc.pm2_env.restart_time : 0;
        const cpu = proc.monit ? proc.monit.cpu : 0;
        const memBytes = proc.monit ? proc.monit.memory : 0;
        const memMb = (memBytes / (1024 * 1024)).toFixed(1);

        // Status Badge Style
        let statusBadge = '';
        if (status === 'online') {
          statusBadge = `<span class="px-2 py-1 text-xs font-semibold rounded-full bg-green-500/20 text-green-300 border border-green-500/30">online</span>`;
        } else if (status === 'stopped') {
          statusBadge = `<span class="px-2 py-1 text-xs font-semibold rounded-full bg-red-500/20 text-red-300 border border-red-500/30">stopped</span>`;
        } else {
          statusBadge = `<span class="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">${status}</span>`;
        }

        // Action Buttons
        let actionButtons = '';
        if (status === 'online') {
          actionButtons += `<button class="pm2-action-btn px-2 py-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold mr-1.5 transition-all active:scale-95" data-action="stop" data-target="${pmId}">Stop</button>`;
        } else {
          actionButtons += `<button class="pm2-action-btn px-2 py-1 bg-green-600/20 hover:bg-green-600/30 text-green-300 border border-green-500/30 rounded-lg text-xs font-semibold mr-1.5 transition-all active:scale-95" data-action="restart" data-target="${pmId}">Start</button>`;
        }
        actionButtons += `<button class="pm2-action-btn px-2 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-semibold mr-1.5 transition-all active:scale-95" data-action="restart" data-target="${pmId}">Restart</button>`;
        actionButtons += `<button class="pm2-action-btn px-2 py-1 bg-red-600/20 hover:bg-red-600/30 text-rose-300 border border-red-500/30 rounded-lg text-xs font-semibold transition-all active:scale-95" data-action="delete" data-target="${pmId}">Delete</button>`;

        html += `
          <tr class="hover:bg-white/[0.02] transition-colors">
            <td class="px-2 sm:px-4 py-1.5 sm:py-3 font-mono text-gray-400">${pmId}</td>
            <td class="px-2 sm:px-4 py-1.5 sm:py-3 font-semibold text-gray-200">${name}</td>
            <td class="px-2 sm:px-4 py-1.5 sm:py-3">${statusBadge}</td>
            <td class="px-2 sm:px-4 py-1.5 sm:py-3 text-right font-mono">${restarts}</td>
            <td class="px-2 sm:px-4 py-1.5 sm:py-3 text-right font-mono">${cpu}%</td>
            <td class="px-2 sm:px-4 py-1.5 sm:py-3 text-right font-mono">${memMb} MB</td>
            <td class="px-2 sm:px-4 py-1.5 sm:py-3 text-right">${actionButtons}</td>
          </tr>
        `;
      });

      $pm2TableBody.html(html);
    }).fail(function () {
      $pm2TableBody.html('<tr><td colspan="7" class="px-4 py-8 text-center text-rose-400 font-medium">Failed to fetch PM2 list. Make sure PM2 is running.</td></tr>');
    });
  };

  // Bind Action Buttons
  $(document).on('click', '.pm2-action-btn', function (e) {
    e.preventDefault();
    const action = $(this).data('action');
    const target = $(this).data('target');
    const $btn = $(this);
    
    $btn.prop('disabled', true).addClass('opacity-50');
    
    $.ajax({
      url: '/api/pm2/action',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ action: action, target: String(target) }),
      success: function () {
        fetchPM2List();
      },
      error: function (xhr) {
        alert('Action failed: ' + ((xhr.responseJSON && xhr.responseJSON.error) || 'Unknown error'));
        fetchPM2List();
      }
    });
  });

  // Bind Start Button
  $('#pm2StartBtn').on('click', function (e) {
    e.preventDefault();
    const script = $('#pm2StartInput').val().trim();
    if (!script) return;

    const $btn = $(this);
    $btn.prop('disabled', true).addClass('opacity-50');

    $.ajax({
      url: '/api/pm2/action',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ action: 'start', target: script }),
      success: function () {
        $('#pm2StartInput').val('');
        fetchPM2List();
      },
      error: function (xhr) {
        alert('Start failed: ' + ((xhr.responseJSON && xhr.responseJSON.error) || 'Unknown error'));
      },
      complete: function () {
        $btn.prop('disabled', false).removeClass('opacity-50');
      }
    });
  });

  // Refresh Button
  $('#pm2RefreshBtn').on('click', function (e) {
    e.preventDefault();
    fetchPM2List();
  });

  // Auto-refresh PM2 list every 6 seconds if visible
  if (pm2CardVisible) {
    fetchPM2List();
  }
  setInterval(function () {
    fetchPM2List();
  }, 6000);

  // Docker UI Logic
  // Apply initial Docker view mode styles on load
  $('.docker-tab-btn').removeClass(activeRangeBtnClass).addClass(inactiveRangeBtnClass);
  $(`.docker-tab-btn[data-docker-mode="${dockerViewMode}"]`).addClass(activeRangeBtnClass).removeClass(inactiveRangeBtnClass);
  
  if (dockerViewMode === 'containers') {
    $dockerContainersView.show();
    $dockerImagesView.hide();
    $dockerRunWrapper.addClass('hidden');
  } else {
    $dockerContainersView.hide();
    $dockerImagesView.show();
    $dockerRunWrapper.removeClass('hidden');
  }

  // Switch tab event handler
  $('.docker-tab-btn').on('click', function () {
    const mode = $(this).data('docker-mode');
    if (mode === dockerViewMode) return;

    dockerViewMode = mode;
    localStorage.setItem('docker_view_mode', dockerViewMode);
    
    $('.docker-tab-btn').removeClass(activeRangeBtnClass).addClass(inactiveRangeBtnClass);
    $(this).addClass(activeRangeBtnClass).removeClass(inactiveRangeBtnClass);
    
    if (dockerViewMode === 'containers') {
      $dockerContainersView.show();
      $dockerImagesView.hide();
      $dockerRunWrapper.addClass('hidden');
      fetchDockerContainers();
    } else {
      $dockerContainersView.hide();
      $dockerImagesView.show();
      $dockerRunWrapper.removeClass('hidden');
      fetchDockerImages();
    }
  });

  const fetchDockerContainers = () => {
    if (!$dockerCard.is(':visible') || dockerViewMode !== 'containers') return;

    $.getJSON('/api/docker/containers', function (data) {
      if (!data || data.length === 0) {
        $dockerContainersTableBody.html('<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500 font-medium">No Docker containers found.</td></tr>');
        return;
      }

      let html = '';
      data.forEach(c => {
        const id = c.ID;
        const name = c.Names;
        const image = c.Image;
        const status = c.Status;
        const state = c.State; // e.g. "running", "exited"
        const ports = c.Ports || '-';

        let statusBadge = '';
        if (state === 'running') {
          statusBadge = `<span class="px-2 py-1 text-xs font-semibold rounded-full bg-green-500/20 text-green-300 border border-green-500/30">running</span>`;
        } else if (state === 'exited' || state === 'created') {
          statusBadge = `<span class="px-2 py-1 text-xs font-semibold rounded-full bg-red-500/20 text-red-300 border border-red-500/30">${state}</span>`;
        } else {
          statusBadge = `<span class="px-2 py-1 text-xs font-semibold rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">${state || status}</span>`;
        }

        let actionButtons = '';
        if (state === 'running') {
          actionButtons += `<button class="docker-action-btn px-2 py-1 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold mr-1.5 transition-all active:scale-95" data-action="stop" data-target="${id}">Stop</button>`;
        } else {
          actionButtons += `<button class="docker-action-btn px-2 py-1 bg-green-600/20 hover:bg-green-600/30 text-green-300 border border-green-500/30 rounded-lg text-xs font-semibold mr-1.5 transition-all active:scale-95" data-action="start" data-target="${id}">Start</button>`;
        }
        actionButtons += `<button class="docker-action-btn px-2 py-1 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded-lg text-xs font-semibold mr-1.5 transition-all active:scale-95" data-action="restart" data-target="${id}">Restart</button>`;
        actionButtons += `<button class="docker-action-btn px-2 py-1 bg-red-600/20 hover:bg-red-600/30 text-rose-300 border border-red-500/30 rounded-lg text-xs font-semibold transition-all active:scale-95" data-action="remove_container" data-target="${id}">Remove</button>`;

        html += `
          <tr class="hover:bg-white/[0.02] transition-colors">
            <td class="px-2 sm:px-4 py-1.5 sm:py-3 font-mono text-xs text-gray-400" title="${id}">${id.substring(0, 12)}</td>
            <td class="px-2 sm:px-4 py-1.5 sm:py-3 font-semibold text-gray-200">${name}</td>
            <td class="px-2 sm:px-4 py-1.5 sm:py-3 font-mono text-xs text-gray-300">${image}</td>
            <td class="px-2 sm:px-4 py-1.5 sm:py-3">${statusBadge} <span class="text-xs text-gray-500 block sm:inline sm:ml-2">${status}</span></td>
            <td class="px-2 sm:px-4 py-1.5 sm:py-3 text-xs font-mono text-gray-400 max-w-[200px] truncate" title="${ports}">${ports}</td>
            <td class="px-2 sm:px-4 py-1.5 sm:py-3 text-right">${actionButtons}</td>
          </tr>
        `;
      });

      $dockerContainersTableBody.html(html);
    }).fail(function () {
      $dockerContainersTableBody.html('<tr><td colspan="6" class="px-4 py-8 text-center text-rose-400 font-medium">Failed to fetch Docker containers.</td></tr>');
    });
  };

  const fetchDockerImages = () => {
    if (!$dockerCard.is(':visible') || dockerViewMode !== 'images') return;

    $.getJSON('/api/docker/images', function (data) {
      if (!data || data.length === 0) {
        $dockerImagesTableBody.html('<tr><td colspan="6" class="px-4 py-8 text-center text-gray-500 font-medium">No Docker images found.</td></tr>');
        return;
      }

      let html = '';
      data.forEach(img => {
        const id = img.ID;
        const repo = img.Repository;
        const tag = img.Tag;
        const created = img.CreatedSince || img.CreatedAt || '-';
        const size = img.Size;

        let actionButtons = `<button class="docker-action-btn px-2 py-1 bg-red-600/20 hover:bg-red-600/30 text-rose-300 border border-red-500/30 rounded-lg text-xs font-semibold transition-all active:scale-95" data-action="remove_image" data-target="${id}">Remove</button>`;

        html += `
          <tr class="hover:bg-white/[0.02] transition-colors">
            <td class="px-2 sm:px-4 py-1.5 sm:py-3 font-mono text-xs text-gray-400" title="${id}">${id.substring(0, 12)}</td>
            <td class="px-2 sm:px-4 py-1.5 sm:py-3 font-semibold text-gray-200">${repo}</td>
            <td class="px-2 sm:px-4 py-1.5 sm:py-3 font-mono text-xs text-gray-300">${tag}</td>
            <td class="px-2 sm:px-4 py-1.5 sm:py-3 text-xs text-gray-400">${created}</td>
            <td class="px-2 sm:px-4 py-1.5 sm:py-3 text-right font-mono text-xs font-semibold">${size}</td>
            <td class="px-2 sm:px-4 py-1.5 sm:py-3 text-right">${actionButtons}</td>
          </tr>
        `;
      });

      $dockerImagesTableBody.html(html);
    }).fail(function () {
      $dockerImagesTableBody.html('<tr><td colspan="6" class="px-4 py-8 text-center text-rose-400 font-medium">Failed to fetch Docker images.</td></tr>');
    });
  };

  const fetchDockerData = () => {
    if (dockerViewMode === 'containers') {
      fetchDockerContainers();
    } else {
      fetchDockerImages();
    }
  };

  // Docker Action Buttons
  $(document).on('click', '.docker-action-btn', function (e) {
    e.preventDefault();
    const action = $(this).data('action');
    const target = $(this).data('target');
    const $btn = $(this);
    
    $btn.prop('disabled', true).addClass('opacity-50');
    
    $.ajax({
      url: '/api/docker/action',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ action: action, target: String(target) }),
      success: function () {
        fetchDockerData();
      },
      error: function (xhr) {
        const errMsg = (xhr.responseJSON && (xhr.responseJSON.error || xhr.responseJSON.output)) || 'Unknown error';
        alert('Docker action failed: ' + errMsg);
        fetchDockerData();
      }
    });
  });

  // Docker Run Button (for images tab)
  $('#dockerRunBtn').on('click', function (e) {
    e.preventDefault();
    const image = $('#dockerRunInput').val().trim();
    if (!image) return;

    const $btn = $(this);
    $btn.prop('disabled', true).addClass('opacity-50');

    $.ajax({
      url: '/api/docker/action',
      method: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({ action: 'run_image', target: image }),
      success: function () {
        $('#dockerRunInput').val('');
        dockerViewMode = 'containers';
        localStorage.setItem('docker_view_mode', 'containers');
        $('.docker-tab-btn').removeClass(activeRangeBtnClass).addClass(inactiveRangeBtnClass);
        $('[data-docker-mode="containers"]').addClass(activeRangeBtnClass).removeClass(inactiveRangeBtnClass);
        $dockerContainersView.show();
        $dockerImagesView.hide();
        $dockerRunWrapper.addClass('hidden');
        fetchDockerContainers();
      },
      error: function (xhr) {
        const errMsg = (xhr.responseJSON && (xhr.responseJSON.error || xhr.responseJSON.output)) || 'Unknown error';
        alert('Docker run failed: ' + errMsg);
      },
      complete: function () {
        $btn.prop('disabled', false).removeClass('opacity-50');
      }
    });
  });

  // Docker Refresh Button
  $('#dockerRefreshBtn').on('click', function (e) {
    e.preventDefault();
    fetchDockerData();
  });

  // Auto-refresh Docker data every 10 seconds if visible
  if (dockerCardVisible) {
    fetchDockerData();
  }
  setInterval(function () {
    fetchDockerData();
  }, 10000);

  // Power Consumption Logic
  const fetchPowerConsumption = () => {
    if (!$powerCard.is(':visible')) return;

    $.getJSON('/api/power', function (data) {
      if (!data) return;

      $powerToday.html(`${data.today !== undefined ? data.today.toFixed(3) : '--'} <span class="text-[10px] sm:text-xs text-gray-400 font-normal">kWh</span>`);
      $powerYesterday.html(`${data.yesterday !== undefined ? data.yesterday.toFixed(3) : '--'} <span class="text-[10px] sm:text-xs text-gray-400 font-normal">kWh</span>`);
      $powerThisMonth.html(`${data.thisMonth !== undefined ? data.thisMonth.toFixed(3) : '--'} <span class="text-[10px] sm:text-xs text-gray-400 font-normal">kWh</span>`);
      $powerLastMonth.html(`${data.lastMonth !== undefined ? data.lastMonth.toFixed(3) : '--'} <span class="text-[10px] sm:text-xs text-gray-400 font-normal">kWh</span>`);
      $powerTodayAvg.html(`${data.todayAvg !== undefined ? data.todayAvg.toFixed(4) : '--'} <span class="text-[10px] sm:text-xs text-gray-400 font-normal">kWh/h</span>`);
      $powerYesterdayAvg.html(`${data.yesterdayAvg !== undefined ? data.yesterdayAvg.toFixed(4) : '--'} <span class="text-[10px] sm:text-xs text-gray-400 font-normal">kWh/h</span>`);

      if (data.threshold && data.thisMonth !== undefined) {
        const pct = Math.min((data.thisMonth / data.threshold) * 100, 100);
        $powerProgressBar.css('width', pct.toFixed(1) + '%');
        if (pct >= 90) {
          $powerProgressBar.removeClass('from-blue-500 to-indigo-500').addClass('from-rose-500 to-red-500');
        } else if (pct >= 70) {
          $powerProgressBar.removeClass('from-blue-500 to-indigo-500').addClass('from-amber-500 to-orange-500');
        } else {
          $powerProgressBar.removeClass('from-rose-500 to-red-500 from-amber-500 to-orange-500').addClass('from-blue-500 to-indigo-500');
        }
        $powerThresholdText.text(`${data.thisMonth.toFixed(3)} / ${data.threshold} kWh (${pct.toFixed(1)}%)`);
        const dailyLimit = (data.threshold / 30).toFixed(3);
        $powerThresholdDay.text(`Daily limit: ${dailyLimit} kWh`);
      }

      if (data.status) {
        $powerStatusBadge.text(data.status);
        if (data.status === 'active') {
          $powerStatusBadge.removeClass('bg-red-500/20 text-red-300 border-red-500/30 bg-yellow-500/20 text-yellow-300 border-yellow-500/30')
            .addClass('bg-green-500/20 text-green-300 border-green-500/30');
        } else if (data.status === 'inactive') {
          $powerStatusBadge.removeClass('bg-green-500/20 text-green-300 border-green-500/30 bg-yellow-500/20 text-yellow-300 border-yellow-500/30')
            .addClass('bg-red-500/20 text-red-300 border-red-500/30');
        } else {
          $powerStatusBadge.removeClass('bg-green-500/20 text-green-300 border-green-500/30 bg-red-500/20 text-red-300 border-red-500/30')
            .addClass('bg-yellow-500/20 text-yellow-300 border-yellow-500/30');
        }
      }

      const now = new Date();
      $powerLastUpdated.text(`Refreshed: ${now.toLocaleTimeString()}`);
    }).fail(function () {
      $powerLastUpdated.text('Refresh failed');
    });
  };

  $powerRefreshBtn.on('click', function (e) {
    e.preventDefault();
    fetchPowerConsumption();
  });

  if (powerCardVisible) {
    fetchPowerConsumption();
  }
  setInterval(function () {
    fetchPowerConsumption();
  }, 60000);

});
